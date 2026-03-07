import { Request, Response } from 'express';
import prisma from '../prismaClient';

// Registrar Evento de Caixa (Abertura, Fechamento, Sangria, Reforço)
export const createEvent = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { type, amount, description } = req.body;

        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        if (!['open', 'close', 'inflow', 'outflow'].includes(type)) {
            res.status(400).json({ error: 'Tipo de evento inválido' });
            return;
        }

        const userId = req.user?.userId;

        const event = await (prisma as any).cashRegisterEvent.create({
            data: {
                tenantId,
                type,
                amount: amount || 0,
                description,
                userId
            }
        });

        res.status(201).json(event);
    } catch (error) {
        console.error('Create Cash Event Error:', error);
        res.status(500).json({ error: 'Erro ao registrar evento de caixa' });
    }
};

// Buscar Histórico de Caixa do Dia
export const getDailyEvents = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const events = await (prisma as any).cashRegisterEvent.findMany({
            where: {
                tenantId,
                createdAt: { gte: today }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calcular Resumo do Dia
        const revenues = await prisma.order.aggregate({
            where: {
                tenantId,
                status: 'completed',
                createdAt: { gte: today }
            },
            _sum: { totalAmount: true }
        });

        const totalOrders = revenues._sum.totalAmount || 0;
        const totalInflow = events.filter((e: any) => e.type === 'inflow').reduce((acc: number, e: any) => acc + e.amount, 0);
        const totalOutflow = events.filter((e: any) => e.type === 'outflow').reduce((acc: number, e: any) => acc + e.amount, 0);
        const openingAmount = events.find((e: any) => e.type === 'open')?.amount || 0;

        const currentBalance = openingAmount + totalOrders + totalInflow - totalOutflow;

        res.json({
            events,
            summary: {
                openingAmount,
                totalOrders,
                totalInflow,
                totalOutflow,
                currentBalance
            }
        });
    } catch (error) {
        console.error('Get Cash Events Error:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do caixa' });
    }
};
