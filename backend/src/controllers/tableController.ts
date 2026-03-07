import { Request, Response } from 'express';
import prisma from '../prismaClient';

export const getTables = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const tables = await (prisma as any).table.findMany({
            where: { tenantId },
            include: {
                orders: {
                    where: { status: { notIn: ['finished', 'cancelled'] } },
                    select: { id: true }
                }
            },
            orderBy: { number: 'asc' }
        });

        const tablesWithStatus = tables.map((t: any) => ({
            ...t,
            isOccupied: t.orders.length > 0
        }));

        res.json(tablesWithStatus);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar mesas' });
    }
};

export const createTable = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { number } = req.body;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }
        if (!number) { res.status(400).json({ error: 'Número da mesa é obrigatório' }); return; }

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        const qrCodeUrl = `${process.env.FRONTEND_URL || ''}/menu/#${tenant?.slug}?table=${number}`;

        const table = await (prisma as any).table.create({
            data: {
                tenantId,
                number: parseInt(number as string),
                qrCodeUrl
            }
        });

        res.status(201).json(table);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar mesa' });
    }
};

export const deleteTable = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        await (prisma as any).table.delete({
            where: { id: parseInt(id as string), tenantId }
        });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar mesa' });
    }
};
