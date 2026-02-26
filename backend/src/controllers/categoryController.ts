import { Request, Response } from 'express';
import prisma from '../prismaClient';

export const getCategories = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const categories = await prisma.category.findMany({
            where: { tenantId },
            orderBy: { order: 'asc' },
            include: {
                products: {
                    where: { active: true }
                }
            }
        });

        res.json(categories);
    } catch (error) {
        console.error('Get Categories Error:', error);
        res.status(500).json({ error: 'Erro ao buscar categorias' });
    }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { name, order } = req.body;

        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        if (!name) {
            res.status(400).json({ error: 'O nome da categoria é obrigatório' });
            return;
        }

        const category = await prisma.category.create({
            data: {
                tenantId,
                name,
                order: order || 0,
            },
        });

        res.status(201).json(category);
    } catch (error) {
        console.error('Create Category Error:', error);
        res.status(500).json({ error: 'Erro ao criar categoria' });
    }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;
        const { name, order } = req.body;

        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        // Verify if category belongs to the tenant
        const existingCategory = await prisma.category.findFirst({
            where: { id: parseInt(id), tenantId },
        });

        if (!existingCategory) {
            res.status(404).json({ error: 'Categoria não encontrada' });
            return;
        }

        const category = await prisma.category.update({
            where: { id: parseInt(id) },
            data: {
                name: name !== undefined ? name : existingCategory.name,
                order: order !== undefined ? order : existingCategory.order,
            },
        });

        res.json(category);
    } catch (error) {
        console.error('Update Category Error:', error);
        res.status(500).json({ error: 'Erro ao atualizar categoria' });
    }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;

        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const existingCategory = await prisma.category.findFirst({
            where: { id: parseInt(id), tenantId },
        });

        if (!existingCategory) {
            res.status(404).json({ error: 'Categoria não encontrada' });
            return;
        }

        await prisma.category.delete({
            where: { id: parseInt(id) },
        });

        res.status(204).send();
    } catch (error) {
        console.error('Delete Category Error:', error);
        res.status(500).json({ error: 'Erro ao deletar categoria' });
    }
};
