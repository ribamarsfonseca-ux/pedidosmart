import { Request, Response } from 'express';
import prisma from '../prismaClient';

export const getDrivers = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const drivers = await (prisma as any).driver.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' }
        });

        res.json(drivers);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar entregadores' });
    }
};

export const createDriver = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { name, phone } = req.body;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }
        if (!name) { res.status(400).json({ error: 'Nome do entregador é obrigatório' }); return; }

        const driver = await (prisma as any).driver.create({
            data: {
                tenantId,
                name,
                phone
            }
        });

        res.status(201).json(driver);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar entregador' });
    }
};

export const updateDriverStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;
        const { active } = req.body;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const driver = await (prisma as any).driver.update({
            where: { id: parseInt(id as string), tenantId },
            data: { active: !!active }
        });

        res.json(driver);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar entregador' });
    }
};

export const deleteDriver = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        await (prisma as any).driver.delete({
            where: { id: parseInt(id as string), tenantId }
        });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar entregador' });
    }
};
