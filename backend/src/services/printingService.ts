import { Order, OrderItem, Product, Tenant } from '@prisma/client';

type OrderWithItems = Order & {
    items: (OrderItem & { product: { name: true } })[];
    tenant: Tenant;
};

export const generateThermalReceipt = (order: any, width: '80mm' | '58mm' = '80mm'): string => {
    const { tenant, items } = order;
    const dateStr = new Date(order.createdAt).toLocaleString('pt-BR');

    let itemsHtml = items.map((item: any) => {
        const addonsHtml = item.addons && item.addons.length > 0
            ? `<div style="font-size: 10px; color: #555; margin-left: 10px;">
                ${item.addons.map((a: any) => `+ ${a.addon?.name || a.name}`).join('<br>')}
               </div>`
            : '';

        return `
            <tr>
                <td style="padding: 4px 0;">
                    ${item.quantity}x ${item.product.name}
                    ${addonsHtml}
                </td>
                <td style="text-align: right; padding: 4px 0; vertical-align: top;">
                    ${(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
            </tr>
        `;
    }).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Courier New', Courier, monospace; width: ${width}; margin: 0; padding: 10px; font-size: 12px; line-height: 1.2; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .divider { border-top: 1px dashed #000; margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; }
                .footer { margin-top: 20px; font-size: 10px; }
            </style>
        </head>
        <body>
            <div class="center">
                <span class="bold" style="font-size: 16px;">${tenant.name}</span><br>
                ${tenant.address || ''}<br>
                ${tenant.whatsapp || ''}
            </div>
            
            <div class="divider"></div>
            
            <div class="center bold">
                PEDIDO #${order.orderNumber || order.id}<br>
                ${dateStr}
            </div>
            
            <div class="divider"></div>
            
            <div>
                <span class="bold">CLIENTE:</span> ${order.customerName}<br>
                <span class="bold">TIPO:</span> ${order.fulfillmentType.toUpperCase()}
                ${order.fulfillmentType === 'delivery' ? `<br><span class="bold">END:</span> ${order.addressStreet}, ${order.addressNumber}` : ''}
            </div>
            
            <div class="divider"></div>
            
            <table>
                <thead>
                    <tr>
                        <th style="text-align: left;">ITEM</th>
                        <th style="text-align: right;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div class="divider"></div>
            
            <div style="text-align: right; font-size: 14px;" class="bold">
                TOTAL: ${order.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            
            <div class="divider"></div>
            
            <div class="center footer">
                PAGAMENTO: ${order.paymentMethod.toUpperCase()}<br>
                Obrigado pela preferência!<br>
                SmartPede - Sistema de PDV & Delivery
            </div>
            
            <script>window.print(); setTimeout(() => window.close(), 500);</script>
        </body>
        </html>
    `;
};
