import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const users = await prisma.user.findMany({
            where: { tenantId },
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar equipe' });
    }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { email, password, role } = req.body;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }
        if (!email || !password) { res.status(400).json({ error: 'Email e senha são obrigatórios' }); return; }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: 'Este e-mail já está sendo usado por outro usuário.' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                tenantId,
                email,
                password: hashedPassword,
                role: role || 'attendant'
            },
            select: {
                id: true,
                email: true,
                role: true
            }
        });

        res.status(201).json(newUser);
    } catch (error) {
        console.error('Create User Error:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const userId = parseInt(req.params.id as string);
        const currentUserId = req.user?.userId;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        if (userId === currentUserId) {
            res.status(400).json({ error: 'Você não pode excluir seu próprio usuário.' });
            return;
        }

        const userToDelete = await prisma.user.findUnique({ where: { id: userId } });
        if (!userToDelete || userToDelete.tenantId !== tenantId) {
            res.status(404).json({ error: 'Usuário não encontrado' });
            return;
        }

        if (userToDelete.role === 'admin') {
            // Conta quantos admins restam
            const adminsCount = await prisma.user.count({
                where: { tenantId, role: 'admin' }
            });
            if (adminsCount <= 1) {
                res.status(400).json({ error: 'O restaurante deve ter pelo menos um administrador.' });
                return;
            }
        }

        await prisma.user.delete({ where: { id: userId } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir usuário' });
    }
};

// Public Route: Funcionário faz login no PDV
export const loginUserPDV = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, slug } = req.body;

        if (!email || !password || !slug) {
            res.status(400).json({ error: 'E-mail, senha e slug da loja são obrigatórios' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({ where: { slug: slug.toLowerCase() } });
        if (!tenant) {
            res.status(401).json({ error: 'Loja não encontrada' });
            return;
        }

        if (!tenant.active) {
            res.status(403).json({ error: 'Esta loja está bloqueada. Contate o administrador.' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Valida se o usuário existe e se pertence à loja (tenant) que está tentando acessar
        if (!user || user.tenantId !== tenant.id) {
            res.status(401).json({ error: 'Credenciais inválidas para esta loja' });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Credenciais inválidas' });
            return;
        }

        // Criar nome do atendente (se não tiver nome explícito até pegar primeira parte do email)
        const attendantName = email.split('@')[0];

        // O Token vai com role: user.role e attendantName
        const token = jwt.sign(
            { tenantId: tenant.id, role: user.role, userId: user.id, attendantName },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            message: 'Acesso PDV autorizado',
            tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
            attendantName,
            token
        });
    } catch (error) {
        console.error('Login User PDV Error:', error);
        res.status(500).json({ error: 'Erro ao processar login de funcionário' });
    }
};
