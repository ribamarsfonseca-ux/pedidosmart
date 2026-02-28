import { Request, Response } from 'express';
import prisma from '../prismaClient';

// Public Route: Create an Order (By Customer in the Menu)
export const createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            tenantId,
            customerName,
            customerPhone,
            items,
            fulfillmentType,
            paymentMethod,
            addressStreet,
            addressNumber,
            addressDistrict,
            addressComplement
        } = req.body;

        if (!tenantId || !customerName || !customerPhone || !items || !items.length) {
            res.status(400).json({ error: 'Dados do pedido incompletos' });
            return;
        }

        // Calcular o total e montar os itens verificando os produtos no banco
        let totalAmount = 0;
        const orderItemsData = [];

        for (const item of items) {
            const product = await prisma.product.findUnique({ where: { id: item.productId } });

            if (!product || product.tenantId !== tenantId || !product.active) {
                res.status(400).json({ error: `Produto ID ${item.productId} inválido ou inativo` });
                return;
            }

            const unitPrice = product.price;
            totalAmount += unitPrice * item.quantity;

            orderItemsData.push({
                productId: product.id,
                quantity: item.quantity,
                unitPrice: unitPrice
            });
        }

        // 2. Gerar Número do Pedido (Sequencial por Tenant)
        const lastOrder = await prisma.order.findFirst({
            where: { tenantId },
            orderBy: { orderNumber: 'desc' },
        });

        const nextOrderNumber = (lastOrder?.orderNumber || 0) + 1;

        // Criar o pedido (Nested Write Prisma)
        const order = await prisma.order.create({
            data: {
                tenantId,
                orderNumber: nextOrderNumber,
                customerName,
                customerPhone,
                totalAmount,
                status: 'pending',
                fulfillmentType: fulfillmentType || 'delivery',
                paymentMethod: paymentMethod || 'money',
                addressStreet,
                addressNumber,
                addressDistrict,
                addressComplement,
                items: {
                    create: orderItemsData
                }
            },
            include: { items: true }
        });

        res.status(201).json({
            message: 'Pedido criado com sucesso',
            order
        });
    } catch (error) {
        console.error('Create Order Error:', error);
        res.status(500).json({ error: 'Erro ao criar pedido' });
    }
};

// Protected Admin Route: Get All Orders
export const getOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const orders = await prisma.order.findMany({
            where: { tenantId },
            include: {
                items: {
                    include: { product: { select: { name: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(orders);
    } catch (error) {
        console.error('Get Orders Error:', error);
        res.status(500).json({ error: 'Erro ao buscar pedidos' });
    }
};

// Protected Admin Route: Update Order Status
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;
        const { status } = req.body; // pending, accepted, preparing, ready, completed, cancelled

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        // Verify if order belongs to the tenant
        const existingOrder = await prisma.order.findFirst({
            where: { id: parseInt(id as string), tenantId },
        });

        if (!existingOrder) {
            res.status(404).json({ error: 'Pedido não encontrado' });
            return;
        }

        const order = await prisma.order.update({
            where: { id: parseInt(id as string) },
            data: { status: status as string },
        });

        res.json(order);
    } catch (error) {
        console.error('Update Order Status Error:', error);
        res.status(500).json({ error: 'Erro ao atualizar status do pedido' });
    }
};

// Public Route: Get Order Status (for customer tracking)
export const getOrderPublicStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const order = await prisma.order.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true
            }
        });

        if (!order) {
            res.status(404).json({ error: 'Pedido não encontrado' });
            return;
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar status' });
    }
};
