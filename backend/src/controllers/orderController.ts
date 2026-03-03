import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { generateThermalReceipt } from '../services/printingService';

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

        // Emitir evento Socket.io para o lojista
        const io = req.app.get('io');
        if (io) {
            io.to(`tenant-${tenantId}`).emit('new-order', order);
        }

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
        const { status, cancelReason } = req.body; // pending, accepted, preparing, ready, completed, cancelled

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
            data: {
                status: status as string,
                cancelReason: cancelReason as string || undefined
            },
            include: {
                items: {
                    include: { product: { select: { name: true } } }
                }
            }
        });

        // Emitir evento Socket.io de atualização
        const io = req.app.get('io');
        if (io) {
            io.to(`tenant-${tenantId}`).emit('order-updated', order);
        }

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
            where: { id: parseInt(id as string) },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true,
                totalAmount: true,
                fulfillmentType: true,
                paymentMethod: true,
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                price: true,
                                imageUrl: true,
                                description: true
                            }
                        }
                    }
                }
            }
        });

        if (!order) {
            res.status(404).json({ error: 'Pedido não encontrado' });
            return;
        }

        res.json(order);
    } catch (error) {
        console.error('Get Public Order Error:', error);
        res.status(500).json({ error: 'Erro ao buscar status do pedido' });
    }
};

// Protected Admin Route: Export Orders to CSV (Backup)
export const exportOrdersBackup = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { type } = req.query; // 'daily' or 'full'

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        let whereClause: any = { tenantId };

        if (type === 'daily') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            whereClause.createdAt = { gte: today };
        }

        const orders = await prisma.order.findMany({
            where: whereClause,
            include: {
                items: {
                    include: { product: { select: { name: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Generate CSV
        let csv = 'ID,Numero,Data,Cliente,Telefone,Tipo,Pagamento,Total,Status,Itens\n';
        orders.forEach(o => {
            const itemsStr = o.items.map(i => `${i.quantity}x ${i.product.name}`).join(' | ');
            const dateStr = new Date(o.createdAt).toLocaleString('pt-BR');
            csv += `${o.id},${o.orderNumber},${dateStr},"${o.customerName}",${o.customerPhone},${o.fulfillmentType},${o.paymentMethod},${o.totalAmount},${o.status},"${itemsStr}"\n`;
        });

        const filename = type === 'daily' ? `backup_diario_${new Date().toISOString().split('T')[0]}.csv` : `backup_completo_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.status(200).send(csv);

    } catch (error) {
        console.error('Export Backup Error:', error);
        res.status(500).json({ error: 'Erro ao gerar backup' });
    }
};

// Thermal Receipt Generation
export const getThermalReceipt = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;
        const { width } = req.query;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const order = await prisma.order.findFirst({
            where: { id: parseInt(id), tenantId },
            include: {
                items: { include: { product: { select: { name: true } } } },
                tenant: true
            }
        });

        if (!order) { res.status(404).json({ error: 'Pedido não encontrado' }); return; }

        const html = generateThermalReceipt(order, (width?.toString() as any) || '80mm');
        res.header('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao gerar recibo' });
    }
};

// CRM Dashboard Metrics
export const getCRMDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const orders = await prisma.order.findMany({
            where: { tenantId, status: { in: ['finished', 'completed'] } }
        });

        const vgv = orders.reduce((acc, o) => acc + o.totalAmount, 0);
        const count = orders.length;
        const averageTicket = count > 0 ? vgv / count : 0;

        res.json({ vgv, count, averageTicket });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar dados CRM' });
    }
};

// Export Customer List for Marketing (CSV)
export const exportCustomersCRM = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const orders = await prisma.order.findMany({
            where: { tenantId },
            select: { customerName: true, customerPhone: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        });

        const customersMap = new Map();
        orders.forEach(o => {
            if (!customersMap.has(o.customerPhone)) {
                customersMap.set(o.customerPhone, {
                    name: o.customerName,
                    phone: o.customerPhone,
                    lastOrder: o.createdAt
                });
            }
        });

        const customers = Array.from(customersMap.values());

        let csv = 'Nome,WhatsApp,Ultimo_Pedido\n';
        customers.forEach(c => {
            const dateStr = new Date(c.lastOrder).toLocaleDateString();
            csv += `"${c.name}",${c.phone},${dateStr}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=base_clientes_crm.csv');
        res.status(200).send(csv);

    } catch (error) {
        res.status(500).json({ error: 'Erro ao exportar base CRM' });
    }
};

// Customer Request Cancellation
export const requestCancellation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const order = await prisma.order.findUnique({
            where: { id: parseInt(id) }
        });

        if (!order) { res.status(404).json({ error: 'Pedido não encontrado' }); return; }

        // Only allow if status is pending or accepted
        if (!['pending', 'accepted'].includes(order.status)) {
            res.status(400).json({ error: 'Este pedido já está em preparo ou pronto e não pode ser cancelado pelo app.' });
            return;
        }

        const updatedOrder = await prisma.order.update({
            where: { id: parseInt(id) },
            data: {
                cancellationRequested: true,
                cancelReason: reason || 'Solicitado pelo cliente'
            }
        });

        // Notify via socket
        const io = req.app.get('io');
        if (io) {
            io.to(`tenant-${order.tenantId}`).emit('order-updated', updatedOrder);
        }

        res.json({ message: 'Solicitação de cancelamento enviada com sucesso.', order: updatedOrder });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao solicitar cancelamento' });
    }
};
