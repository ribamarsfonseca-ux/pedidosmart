import { Request, Response } from 'express';
import prisma from '../prismaClient';

export const getProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const products = await prisma.product.findMany({
            where: { tenantId },
            include: {
                category: { select: { name: true } },
                addonGroups: { include: { addons: true } }
            },
            orderBy: { order: 'asc' },
        });

        res.json(products);
    } catch (error) {
        console.error('Get Products Error:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { name, description, price, imageUrl, categoryId, active, order, useStock, stockQuantity } = req.body;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }
        if (!name || price === undefined || !categoryId) {
            res.status(400).json({ error: 'Nome, preço e categoria são obrigatórios' });
            return;
        }

        // Verify category belongs to tenant
        const categoryExists = await prisma.category.findFirst({
            where: { id: parseInt(categoryId as string), tenantId }
        });

        if (!categoryExists) {
            res.status(400).json({ error: 'Categoria inválida' });
            return;
        }

        const product = await prisma.product.create({
            data: {
                tenantId,
                categoryId: parseInt(categoryId as string),
                name,
                description,
                price: parseFloat(price as string),
                imageUrl,
                active: active !== undefined ? active : true,
                order: order !== undefined ? parseInt(order as string) : 0,
                useStock: useStock !== undefined ? Boolean(useStock) : false,
                stockQuantity: stockQuantity !== undefined ? parseInt(stockQuantity as string) : 0,
            },
        });

        res.status(201).json(product);
    } catch (error) {
        console.error('Create Product Error:', error);
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;
        const { name, description, price, imageUrl, categoryId, active, order, useStock, stockQuantity } = req.body;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const existingProduct = await prisma.product.findFirst({
            where: { id: parseInt(id), tenantId },
        });

        if (!existingProduct) {
            res.status(404).json({ error: 'Produto não encontrado' });
            return;
        }

        if (categoryId) {
            const categoryExists = await prisma.category.findFirst({
                where: { id: parseInt(categoryId as string), tenantId }
            });
            if (!categoryExists) {
                res.status(400).json({ error: 'Categoria inválida' });
                return;
            }
        }

        const product = await prisma.product.update({
            where: { id: parseInt(id) },
            data: {
                categoryId: categoryId !== undefined ? parseInt(categoryId as string) : existingProduct.categoryId,
                name: name !== undefined ? name : existingProduct.name,
                description: description !== undefined ? description : existingProduct.description,
                price: price !== undefined ? parseFloat(price as string) : existingProduct.price,
                imageUrl: imageUrl !== undefined ? imageUrl : existingProduct.imageUrl,
                active: active !== undefined ? active : existingProduct.active,
                order: order !== undefined ? parseInt(order as string) : (existingProduct as any).order || 0,
                useStock: useStock !== undefined ? Boolean(useStock) : existingProduct.useStock,
                stockQuantity: stockQuantity !== undefined ? parseInt(stockQuantity as string) : existingProduct.stockQuantity,
            },
        });

        res.json(product);
    } catch (error) {
        console.error('Update Product Error:', error);
        res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const existingProduct = await prisma.product.findFirst({
            where: { id: parseInt(id), tenantId },
        });

        if (!existingProduct) {
            res.status(404).json({ error: 'Produto não encontrado' });
            return;
        }

        await prisma.product.delete({
            where: { id: parseInt(id) },
        });

        res.status(204).send();
    } catch (error) {
        console.error('Delete Product Error:', error);
        res.status(500).json({ error: 'Erro ao deletar produto' });
    }
};
