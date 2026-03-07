import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient';

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
