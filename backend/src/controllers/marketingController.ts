import { Request, Response } from 'express';
import prisma from '../prismaClient';

// --- CUPONS ---

export const createCoupon = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { code, type, value, minOrder, maxUsage, expiresAt } = req.body;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const coupon = await prisma.coupon.create({
            data: {
                tenantId,
                code: code.toUpperCase(),
                type,
                value,
                minOrder: minOrder || 0,
                maxUsage,
                expiresAt: expiresAt ? new Date(expiresAt) : null
            }
        });

        res.status(201).json(coupon);
    } catch (error) {
        console.error('Create Coupon Error:', error);
        res.status(500).json({ error: 'Erro ao criar cupom' });
    }
};

export const getCoupons = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const coupons = await prisma.coupon.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        res.json(coupons);
    } catch (error) {
        console.error('Get Coupons Error:', error);
        res.status(500).json({ error: 'Erro ao buscar cupons' });
    }
};

export const deleteCoupon = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        await prisma.coupon.delete({
            where: { id: parseInt(id as string), tenantId }
        });

        res.status(204).send();
    } catch (error) {
        console.error('Delete Coupon Error:', error);
        res.status(500).json({ error: 'Erro ao excluir cupom' });
    }
};

// Rota Pública: Validar Cupom no Check-out
export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code, tenantId, orderAmount } = req.body;

        const coupon = await prisma.coupon.findFirst({
            where: {
                tenantId: parseInt(tenantId),
                code: code.toUpperCase(),
                active: true
            }
        });

        if (!coupon) {
            res.status(404).json({ error: 'Cupom inválido ou expirado' });
            return;
        }

        // Validações
        if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
            res.status(400).json({ error: 'Cupom expirado' });
            return;
        }

        if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
            res.status(400).json({ error: 'Limite de uso do cupom atingido' });
            return;
        }

        if (orderAmount < coupon.minOrder) {
            res.status(400).json({ error: `Pedido mínimo para este cupom: R$ ${coupon.minOrder.toFixed(2)}` });
            return;
        }

        res.json({
            id: coupon.id,
            type: coupon.type,
            value: coupon.value
        });
    } catch (error) {
        console.error('Validate Coupon Error:', error);
        res.status(500).json({ error: 'Erro ao validar cupom' });
    }
};

// --- CLIENTES ---

export const getCustomers = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const customers = await prisma.customer.findMany({
            where: { tenantId },
            include: {
                _count: { select: { orders: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json(customers);
    } catch (error) {
        console.error('Get Customers Error:', error);
        res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
};

export const getCustomerDetail = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { phone } = req.params;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const customer = await prisma.customer.findFirst({
            where: { tenantId, phone: phone as string },
            include: {
                orders: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    include: { items: { include: { product: { select: { name: true } } } } }
                }
            }
        });

        if (!customer) {
            res.status(404).json({ error: 'Cliente não encontrado' });
            return;
        }

        res.json(customer);
    } catch (error) {
        console.error('Get Customer Detail Error:', error);
        res.status(500).json({ error: 'Erro ao buscar detalhes do cliente' });
    }
};
