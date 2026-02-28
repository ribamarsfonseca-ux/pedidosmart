import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export const registerTenant = async (req: Request, res: Response): Promise<void> => {
    try {
        const { tenantName, slug, adminEmail, adminPassword, logoUrl } = req.body;

        // Validate inputs
        if (!tenantName || !slug || !adminEmail || !adminPassword) {
            res.status(400).json({ error: 'Todos os campos são obrigatórios' });
            return;
        }

        // Check if slug or email exists
        const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
        if (existingTenant) {
            res.status(400).json({ error: 'Slug do restaurante já em uso' });
            return;
        }

        const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (existingUser) {
            res.status(400).json({ error: 'E-mail do administrador já cadastrado' });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Create Tenant and Admin User transactionally
        const result = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: { name: tenantName, slug, logoUrl },
            });

            const user = await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    email: adminEmail,
                    password: hashedPassword,
                    role: 'admin',
                },
            });

            return { tenant, user };
        });

        const token = jwt.sign(
            { userId: result.user.id, tenantId: result.tenant.id, role: result.user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Restaurante criado com sucesso',
            tenant: result.tenant,
            token,
        });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Erro interno ao criar restaurante' });
    }
};

export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
            return;
        }

        const user = await prisma.user.findUnique({ include: { tenant: true }, where: { email } });

        if (!user) {
            res.status(401).json({ error: 'Credenciais inválidas' });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Credenciais inválidas' });
            return;
        }

        const token = jwt.sign(
            { userId: user.id, tenantId: user.tenantId, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login realizado com sucesso',
            tenant: user.tenant,
            token,
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Erro interno durante o login' });
    }
};

// Public route to get tenant data for the Menu Application
export const getTenantBySlug = async (req: Request, res: Response): Promise<void> => {
    try {
        const { slug } = req.params;

        const tenant = await prisma.tenant.findFirst({
            where: { slug: slug as string, active: true },
            select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                planType: true,
                whatsapp: true,
                address: true,
                googleMapsUrl: true,
                openingHours: true,
                paymentMethods: true,
                primaryColor: true,
                categories: {
                    orderBy: { order: 'asc' },
                    include: {
                        products: {
                            where: { active: true }
                        }
                    }
                }
            }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Restaurante não encontrado ou inativo' });
            return;
        }

        res.json(tenant);
    } catch (error) {
        console.error('Get Tenant Error:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do restaurante' });
    }
};

export const updateTenant = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const {
            logoUrl,
            whatsapp,
            address,
            googleMapsUrl,
            paymentMethods,
            openingHours,
            primaryColor
        } = req.body;

        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const updatedTenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                logoUrl,
                whatsapp,
                address,
                googleMapsUrl,
                paymentMethods,
                openingHours,
                primaryColor
            }
        });

        res.json({ message: 'Configurações atualizadas', tenant: updatedTenant });
    } catch (error) {
        console.error('Update Tenant Error:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }
};
