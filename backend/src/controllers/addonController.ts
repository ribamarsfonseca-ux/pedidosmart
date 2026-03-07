import { Request, Response } from 'express';
import prisma from '../prismaClient';

export const createAddonGroup = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { name, minChoices, maxChoices, isRequired, productIds } = req.body;

        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const addonGroup = await prisma.addonGroup.create({
            data: {
                tenantId,
                name,
                minChoices: minChoices || 0,
                maxChoices: maxChoices || 1,
                isRequired: isRequired || false,
                products: productIds ? {
                    connect: productIds.map((id: number) => ({ id }))
                } : undefined
            },
            include: { products: true }
        });

        res.status(201).json(addonGroup);
    } catch (error) {
        console.error('Create AddonGroup Error:', error);
        res.status(500).json({ error: 'Erro ao criar grupo de adicionais' });
    }
};

export const getAddonGroups = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const groups = await prisma.addonGroup.findMany({
            where: { tenantId },
            include: { addons: true, products: true }
        });

        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar grupos de adicionais' });
    }
};

export const updateAddonGroup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        const { name, minChoices, maxChoices, isRequired, productIds } = req.body;

        const group = await prisma.addonGroup.findUnique({ where: { id: Number(id) } });
        if (!group || group.tenantId !== tenantId) {
            res.status(404).json({ error: 'Grupo não encontrado' });
            return;
        }

        const updated = await prisma.addonGroup.update({
            where: { id: Number(id) },
            data: {
                name,
                minChoices,
                maxChoices,
                isRequired,
                products: productIds ? {
                    set: productIds.map((id: number) => ({ id }))
                } : undefined
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar grupo' });
    }
};

export const deleteAddonGroup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;

        const group = await prisma.addonGroup.findUnique({ where: { id: Number(id) } });
        if (!group || group.tenantId !== tenantId) {
            res.status(404).json({ error: 'Grupo não encontrado' });
            return;
        }

        await prisma.addonGroup.delete({ where: { id: Number(id) } });
        res.json({ message: 'Grupo removido com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir grupo' });
    }
};

// --- ADDONS (Items within groups) ---

export const createAddon = async (req: Request, res: Response): Promise<void> => {
    try {
        const { addonGroupId, name, price, active } = req.body;
        const tenantId = req.user?.tenantId;

        const group = await prisma.addonGroup.findUnique({ where: { id: Number(addonGroupId) } });
        if (!group || group.tenantId !== tenantId) {
            res.status(404).json({ error: 'Grupo de adicionais não encontrado' });
            return;
        }

        const addon = await prisma.addon.create({
            data: {
                addonGroupId: Number(addonGroupId),
                name,
                price: price || 0,
                active: active !== undefined ? active : true
            }
        });

        res.status(201).json(addon);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar adicional' });
    }
};

export const updateAddon = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, price, active } = req.body;
        const tenantId = req.user?.tenantId;

        const addon = await prisma.addon.findUnique({
            where: { id: Number(id) },
            include: { group: true }
        });

        if (!addon || addon.group.tenantId !== tenantId) {
            res.status(404).json({ error: 'Adicional não encontrado' });
            return;
        }

        const updated = await prisma.addon.update({
            where: { id: Number(id) },
            data: { name, price, active }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar adicional' });
    }
};

export const deleteAddon = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;

        const addon = await prisma.addon.findUnique({
            where: { id: Number(id) },
            include: { group: true }
        });

        if (!addon || addon.group.tenantId !== tenantId) {
            res.status(404).json({ error: 'Adicional não encontrado' });
            return;
        }

        await prisma.addon.delete({ where: { id: Number(id) } });
        res.json({ message: 'Adicional removido' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir adicional' });
    }
};
