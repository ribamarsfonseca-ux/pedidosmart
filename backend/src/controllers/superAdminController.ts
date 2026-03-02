import { Request, Response } from 'express';
import prisma from '../prismaClient';
import bcrypt from 'bcryptjs';

// Esse controlador é para VOCÊ usar para gerenciar seus clientes
export const getAllTenants = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenants = await prisma.tenant.findMany({
            include: {
                _count: {
                    select: { products: true, orders: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tenants);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar restaurantes' });
    }
};

export const updateTenantStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { active, subscriptionStatus, planType, nextBillingDate } = req.body;

        const tenant = await prisma.tenant.update({
            where: { id: parseInt(id as string) },
            data: {
                active,
                subscriptionStatus,
                planType,
                nextBillingDate: nextBillingDate ? new Date(nextBillingDate) : undefined
            }
        });

        res.json({ message: 'Status do restaurante atualizado', tenant });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar restaurante' });
    }
};

export const resetTenantPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Find the admin user of this tenant
        const user = await prisma.user.findFirst({
            where: { tenantId: parseInt(id as string), role: 'admin' }
        });

        if (!user) {
            res.status(404).json({ error: 'Usuário admin não encontrado para este restaurante.' });
            return;
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Senha resetada com sucesso!' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ error: 'Erro ao resetar senha.' });
    }
};
