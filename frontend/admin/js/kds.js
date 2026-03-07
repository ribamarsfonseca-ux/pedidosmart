/**
 * SmartPedidos KDS - Kitchen Display System
 * Lógica de gerenciamento de pedidos na cozinha via Socket.io
 */

const API_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

const token = localStorage.getItem('token');
let socket;
let orders = [];

// Redireciona se não estiver logado
if (!token) {
    window.location.href = './index.html';
}

function initKDS() {
    updateClock();
    setInterval(updateClock, 1000);
    fetchOrders();
    setupSocket();
}

function updateClock() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('pt-BR');
}

async function fetchOrders() {
    try {
        const res = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Erro ao buscar pedidos');

        const data = await res.json();
        // Filtrar apenas pedidos ativos para a cozinha
        orders = data.filter(o => ['pending', 'accepted', 'preparing'].includes(o.status));
        renderOrders();
    } catch (err) {
        console.error(err);
        alert('Erro ao carregar pedidos. Verifique sua conexão.');
    }
}

function setupSocket() {
    const socketUrl = window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin;
    socket = io(socketUrl);

    const statusEl = document.getElementById('connectionStatus');

    socket.on('connect', () => {
        statusEl.textContent = '● Conectado';
        statusEl.style.color = '#10b981';

        // Entrar na sala do Tenant
        const userData = JSON.parse(atob(token.split('.')[1]));
        socket.emit('join-tenant', userData.tenantId);
    });

    socket.on('disconnect', () => {
        statusEl.textContent = '○ Desconectado';
        statusEl.style.color = '#ef4444';
    });

    socket.on('new-order', (order) => {
        console.log('Novo pedido recebido:', order);
        orders.unshift(order);
        renderOrders();
        playNotification();
    });

    socket.on('order-updated', (updatedOrder) => {
        const index = orders.findIndex(o => o.id === updatedOrder.id);

        // Se o status mudou para algo que não interessa à cozinha, removemos
        if (['ready', 'finished', 'completed', 'cancelled'].includes(updatedOrder.status)) {
            if (index !== -1) orders.splice(index, 1);
        } else {
            if (index !== -1) {
                orders[index] = updatedOrder;
            } else {
                orders.push(updatedOrder);
            }
        }
        renderOrders();
    });
}

function renderOrders() {
    const listPending = document.getElementById('list-pending');
    const listPreparing = document.getElementById('list-preparing');

    const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'accepted');
    const preparingOrders = orders.filter(o => o.status === 'preparing');

    document.getElementById('count-pending').textContent = pendingOrders.length;
    document.getElementById('count-preparing').textContent = preparingOrders.length;

    listPending.innerHTML = pendingOrders.length ? pendingOrders.map(o => renderOrderCard(o)).join('') : '<div class="empty-state">Sem novos pedidos</div>';
    listPreparing.innerHTML = preparingOrders.length ? preparingOrders.map(o => renderOrderCard(o)).join('') : '<div class="empty-state">Nenhum item em preparo</div>';
}

function renderOrderCard(order) {
    const time = new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const statusClass = order.status === 'preparing' ? 'preparing' : 'pending';

    const fulfillmentMap = { 'delivery': 'DELIVERY 🚀', 'pickup': 'RETIRADA 🥡', 'dine_in': 'MESA 🍽️' };

    return `
        <div class="order-card ${statusClass}">
            <div class="order-header">
                <div>
                    <span class="order-id">#${order.orderNumber || order.id}</span>
                    <br>
                    <span class="order-type">${fulfillmentMap[order.fulfillmentType] || order.fulfillmentType}</span>
                </div>
                <div style="text-align: right;">
                    <span class="order-time">${time}</span>
                    <br>
                    <small style="font-weight:600;">${order.customerName}</small>
                </div>
            </div>
            <div class="order-items">
                ${order.items.map(item => `
                    <div class="item-row">
                        <div class="item-main">
                            <span><span class="item-quantity">${item.quantity}x</span> ${item.product?.name || 'Produto'}</span>
                        </div>
                        ${item.addons && item.addons.length > 0 ? `
                            <div class="item-addons">
                                ${item.addons.map(a => `+ ${a.addon?.name || a.name || 'Adicional'}`).join('<br>')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            <div class="order-actions">
                ${order.status !== 'preparing'
            ? `<button class="btn btn-start" onclick="updateStatus(${order.id}, 'preparing')">INICIAR PREPARO</button>`
            : `<button class="btn btn-ready" onclick="updateStatus(${order.id}, 'ready')">MARCAR COMO PRONTO</button>`
        }
            </div>
        </div>
    `;
}

async function updateStatus(orderId, newStatus) {
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) throw new Error('Erro ao atualizar status');

        // O Socket.io cuidará da atualização da UI via evento 'order-updated'
    } catch (err) {
        console.error(err);
        alert('Erro ao atualizar status pedido.');
    }
}

function playNotification() {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log('Bloqueio de áudio pelo browser:', e));
}

// Iniciar
initKDS();
