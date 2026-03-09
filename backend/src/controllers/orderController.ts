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
            addressCity,
            addressState,
            addressComplement,
            couponCode,
            tableNumber,
            tableId: bodyTableId,
            status,
            attendantName // Canal/funcionário: "online", "balcão", nome do funcionário
        } = req.body;

        if (!tenantId || !customerName || !customerPhone || !items || !items.length) {
            res.status(400).json({ error: 'Dados do pedido incompletos' });
            return;
        }

        // 1. Gerenciar Cliente (Busca ou Criação)
        let customer = await prisma.customer.findUnique({
            where: { tenantId_phone: { tenantId, phone: customerPhone } }
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: { tenantId, phone: customerPhone, name: customerName }
            });
        } else if (customer.name !== customerName) {
            // Opcional: Atualizar nome se mudou
            await prisma.customer.update({
                where: { id: customer.id },
                data: { name: customerName }
            });
        }

        // 2. Calcular o total e montar os itens verificando os produtos no banco
        let subtotal = 0;
        const validItems = [];

        for (const item of items) {
            const product = await prisma.product.findUnique({
                where: { id: item.productId },
                include: { addonGroups: { include: { addons: true } } }
            });

            if (!product || product.tenantId !== tenantId || !product.active) {
                res.status(400).json({ error: `Produto ID ${item.productId} inválido ou inativo` });
                return;
            }

            let itemPrice = product.price;
            const itemAddons = [];

            if (item.addons && item.addons.length > 0) {
                for (const addonReq of item.addons) {
                    let foundAddon = null;
                    for (const group of product.addonGroups) {
                        const a = group.addons.find(oa => oa.id === addonReq.addonId);
                        if (a) {
                            foundAddon = a;
                            break;
                        }
                    }

                    if (foundAddon) {
                        itemPrice += foundAddon.price;
                        itemAddons.push({
                            addonId: foundAddon.id,
                            name: foundAddon.name,
                            price: foundAddon.price
                        });
                    }
                }
            }

            subtotal += itemPrice * item.quantity;
            validItems.push({
                productId: product.id,
                quantity: item.quantity,
                unitPrice: itemPrice,
                addons: { create: itemAddons }
            });
        }

        // 3. Validar Cupom e Calcular Desconto
        let discountAmount = 0;
        let couponId = null;

        if (couponCode) {
            const coupon = await prisma.coupon.findFirst({
                where: { tenantId, code: couponCode.toUpperCase(), active: true }
            });

            if (coupon) {
                const now = new Date();
                const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < now;
                const limitReached = coupon.maxUsage && coupon.usedCount >= coupon.maxUsage;
                const minMet = subtotal >= coupon.minOrder;

                if (!isExpired && !limitReached && minMet) {
                    couponId = coupon.id;
                    if (coupon.type === 'percentage') {
                        discountAmount = subtotal * (coupon.value / 100);
                    } else {
                        discountAmount = coupon.value;
                    }
                    // Garantir que desconto não seja maior que o subtotal
                    discountAmount = Math.min(discountAmount, subtotal);
                }
            }
        }

        const totalAmount = subtotal - discountAmount;

        // 4. Buscar Mesa se fornecida (tableNumber legado ou tableId direto)
        let tableId = null;
        if (bodyTableId) {
            tableId = bodyTableId;
        } else if (tableNumber) {
            const table = await (prisma as any).table.findFirst({
                where: { tenantId, number: parseInt(tableNumber as string), active: true }
            });
            if (table) tableId = table.id;
        }

        // 5. Gerar Número do Pedido
        const lastOrder = await prisma.order.findFirst({
            where: { tenantId },
            orderBy: { orderNumber: 'desc' },
        });
        const nextOrderNumber = (lastOrder?.orderNumber || 0) + 1;

        // 6. Criar o pedido (Nested Write Prisma)
        const order = await prisma.order.create({
            data: {
                tenantId,
                orderNumber: nextOrderNumber,
                customerId: customer.id,
                couponId,
                tableId, // Vínculo com Mesa
                customerName,
                customerPhone,
                totalAmount,
                discountAmount,
                status: status || 'pending',
                fulfillmentType: fulfillmentType || 'delivery',
                paymentMethod: paymentMethod || 'money',
                attendantName: attendantName || null,
                addressStreet,
                addressNumber,
                addressDistrict,
                addressCity,
                addressState,
                addressComplement,
                items: {
                    create: validItems.map(vi => ({
                        product: { connect: { id: vi.productId } },
                        quantity: vi.quantity,
                        unitPrice: vi.unitPrice,
                        addons: vi.addons
                    }))
                }
            },
            include: {
                items: {
                    include: {
                        product: { select: { name: true } },
                        addons: { include: { addon: true } }
                    }
                },
                coupon: { select: { code: true } }
            }
        });

        // 6. Atualizar Uso do Cupom
        if (couponId) {
            await prisma.coupon.update({
                where: { id: couponId },
                data: { usedCount: { increment: 1 } }
            });
        }

        // 7. Emitir evento Socket.io
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
        const { status, tableId } = req.query;

        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        let whereClause: any = { tenantId };

        if (status === 'active') {
            whereClause.status = { notIn: ['finished', 'cancelled'] };
        } else if (status) {
            whereClause.status = status as string;
        }

        if (tableId) {
            whereClause.tableId = parseInt(tableId as string);
        }

        const orders = await prisma.order.findMany({
            where: whereClause,
            include: {
                items: {
                    include: {
                        product: { select: { name: true } },
                        addons: { include: { addon: true } }
                    }
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
                    include: {
                        product: { select: { name: true } },
                        addons: { include: { addon: true } }
                    }
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
                        },
                        addons: {
                            include: {
                                addon: true
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
            where: { id: parseInt(id as string), tenantId },
            include: {
                items: { include: { product: { select: { name: true } } } },
                tenant: true
            }
        });

        if (!order) { res.status(404).json({ error: 'Pedido não encontrado' }); return; }

        const paperWidth = (width as "80mm" | "58mm") || '80mm';
        const html = generateThermalReceipt(order as any, paperWidth);
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
            where: { id: parseInt(id as string) }
        });

        if (!order) { res.status(404).json({ error: 'Pedido não encontrado' }); return; }

        // Only allow if status is pending or accepted
        if (!['pending', 'accepted'].includes(order.status)) {
            res.status(400).json({ error: 'Este pedido já está em preparo ou pronto e não pode ser cancelado pelo app.' });
            return;
        }

        const updatedOrder = await prisma.order.update({
            where: { id: parseInt(id as string) },
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

// Protected Admin Route: Delete ALL order history (with admin password verification)
export const deleteAllOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const { adminPassword } = req.body;
        if (!adminPassword) {
            res.status(400).json({ error: 'Senha do administrador é obrigatória.' });
            return;
        }

        // Validar senha do admin
        const adminUser = await prisma.user.findFirst({ where: { tenantId, role: 'admin' } });
        if (!adminUser) { res.status(404).json({ error: 'Administrador não encontrado.' }); return; }

        const bcrypt = require('bcryptjs');
        const valid = await bcrypt.compare(adminPassword, adminUser.password);
        if (!valid) { res.status(401).json({ error: 'Senha incorreta. Operação não autorizada.' }); return; }

        const result = await prisma.order.deleteMany({ where: { tenantId } });

        res.json({ message: `Histórico zerado com sucesso. ${result.count} pedido(s) removido(s).` });
    } catch (error) {
        console.error('Delete All Orders Error:', error);
        res.status(500).json({ error: 'Erro ao zerar histórico.' });
    }
};

// Protected Admin Route: Delete today's order history (with admin password verification)
export const deleteDailyOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) { res.status(401).json({ error: 'Não autorizado' }); return; }

        const { adminPassword } = req.body;
        if (!adminPassword) {
            res.status(400).json({ error: 'Senha do administrador é obrigatória.' });
            return;
        }

        // Validar senha do admin
        const adminUser = await prisma.user.findFirst({ where: { tenantId, role: 'admin' } });
        if (!adminUser) { res.status(404).json({ error: 'Administrador não encontrado.' }); return; }

        const bcrypt = require('bcryptjs');
        const valid = await bcrypt.compare(adminPassword, adminUser.password);
        if (!valid) { res.status(401).json({ error: 'Senha incorreta. Operação não autorizada.' }); return; }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const result = await prisma.order.deleteMany({
            where: { tenantId, createdAt: { gte: today, lt: tomorrow } }
        });

        res.json({ message: `Histórico do dia zerado. ${result.count} pedido(s) removido(s).` });
    } catch (error) {
        console.error('Delete Daily Orders Error:', error);
        res.status(500).json({ error: 'Erro ao zerar histórico do dia.' });
    }
};
// Protected Admin Route: Mark order as voided (refunded/not counted)
export const voidOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const role = req.user?.role;
        if (!tenantId || role !== 'admin') {
            res.status(403).json({ error: 'Apenas administradores podem estornar pedidos.' });
            return;
        }

        const id = req.params.id;
        const { isVoided } = req.body;

        const order = await prisma.order.update({
            where: { id: parseInt(id as string), tenantId },
            data: { isVoided: !!isVoided }
        });

        res.json({ message: isVoided ? 'Pedido estornado com sucesso.' : 'Estorno removido.', order });
    } catch (error) {
        console.error('Void Order Error:', error);
        res.status(500).json({ error: 'Erro ao processar estorno.' });
    }
};
