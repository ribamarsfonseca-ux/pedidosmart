import { Request, Response } from 'express';
import prisma from '../prismaClient';

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
            where: { id: parseInt(id) },
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
