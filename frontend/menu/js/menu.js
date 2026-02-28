const API_URL = 'http://187.77.226.40:3000/api';
let cart = [];
let restaurant = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get Slug from Hash (#slug)
    const slug = window.location.hash.substring(1);
    if (!slug) {
        document.body.innerHTML = '<div style="padding: 2rem; text-align: center;"><h1>Loja não encontrada</h1><p>Verifique o link acessado.</p></div>';
        return;
    }

    // 2. Load Restaurant Data
    try {
        const data = await fetch(`${API_URL}/tenants/menu/${slug}`).then(res => res.json());
        if (data.error) throw new Error(data.error);

        restaurant = data;
        renderMenu(data);
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error(error);
        document.getElementById('loading').innerHTML = `<p style="color: red;">Erro ao carregar cardápio: ${error.message}</p>`;
    }
});

function applyTheme(color) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const contrastColor = brightness > 128 ? '#111827' : '#ffffff';

    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --primary: ${color};
            --on-primary: ${contrastColor};
        }
        .active { color: var(--primary) !important; border-bottom-color: var(--primary) !important; }
        .category-pill.active { background: var(--primary) !important; color: var(--on-primary) !important; }
        .btn-add { background: var(--primary) !important; color: var(--on-primary) !important; }
        .btn-checkout { background: var(--primary) !important; color: var(--on-primary) !important; }
        .btn-action { color: var(--primary) !important; border-color: var(--primary) !important; }
    `;
    document.head.appendChild(style);
}

function renderMenu(data) {
    applyTheme(data.primaryColor || '#3b82f6');
    document.title = `${data.name} | Cardápio Digital`;
    document.getElementById('restName').textContent = data.name;

    // Status e Horário Dinâmico
    const statusEl = document.getElementById('storeStatus');
    const hoursEl = document.getElementById('restHours');

    // Perfil da Loja
    const populateProfile = () => {
        document.getElementById('restAddressModal').innerHTML = `📍 <b>Endereço:</b> ${data.address || 'Não informado'}`;
        document.getElementById('restPhoneModal').innerHTML = `📞 <b>WhatsApp:</b> ${data.whatsapp || 'Não informado'}`;
        document.getElementById('restSlugModal').innerHTML = `🔗 <b>Link:</b> smartpede.com.br/menu/#${data.slug}`;

        if (data.googleMapsUrl) {
            document.getElementById('restMapsModal').innerHTML = `<a href="${data.googleMapsUrl}" target="_blank" class="btn-action" style="display: inline-block; text-decoration: none; margin-top: 5px;">📍 Abrir no Google Maps</a>`;
        }

        document.getElementById('restPaymentsModal').textContent = data.paymentMethods || 'Pix, Dinheiro, Cartão';

        // Tabela de Horários no Modal
        try {
            const hours = JSON.parse(data.openingHours);
            const dayLabels = { 'mon': 'Segunda', 'tue': 'Terça', 'wed': 'Quarta', 'thu': 'Quinta', 'fri': 'Sexta', 'sat': 'Sábado', 'sun': 'Domingo' };
            const daysOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

            document.getElementById('restHoursTableModal').innerHTML = daysOrder.map(day => `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
                    <span>${dayLabels[day]}</span>
                    <span>${hours[day] ? `${hours[day].start} - ${hours[day].end}` : '<span style="color: #ef4444;">Fechado</span>'}</span>
                </div>
            `).join('');
        } catch (e) {
            document.getElementById('restHoursTableModal').textContent = data.openingHours || 'Consulte o estabelecimento';
        }
    };
    populateProfile();

    function checkOpen() {
        if (!data.openingHours) return false;
        try {
            const hours = JSON.parse(data.openingHours);
            const now = new Date();
            const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const today = daysMap[now.getDay()];
            const yesterday = daysMap[now.getDay() === 0 ? 6 : now.getDay() - 1];

            const currentTime = now.getHours() * 100 + now.getMinutes();

            // 1. Verificar se a loja ainda está aberta pelo turno de ONTEM (viva a noite!)
            const yHours = hours[yesterday];
            if (yHours) {
                const yOpen = parseInt(yHours.start.replace(':', ''));
                const yClose = parseInt(yHours.end.replace(':', ''));
                if (yClose < yOpen) { // Cruzou a meia-noite
                    if (currentTime <= yClose) return true;
                }
            }

            // 2. Verificar o turno de HOJE
            const tHours = hours[today];
            if (!tHours) return false;

            const tOpen = parseInt(tHours.start.replace(':', ''));
            const tClose = parseInt(tHours.end.replace(':', ''));

            if (tClose < tOpen) { // Cruza a meia-noite
                return currentTime >= tOpen;
            } else {
                return currentTime >= tOpen && currentTime <= tClose;
            }
        } catch (e) {
            console.error('Erro ao validar horário', e);
            return false;
        }
    }

    const isOpen = checkOpen();
    statusEl.textContent = isOpen ? 'Aberto' : 'Fechado';
    statusEl.style.background = isOpen ? '#10B981' : '#EF4444';

    // Texto de horários amigável
    try {
        const hours = JSON.parse(data.openingHours);
        const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const today = daysMap[new Date().getDay()];
        const tHours = hours[today];
        hoursEl.textContent = tHours ? `Hoje: ${tHours.start} às ${tHours.end}` : 'Fechado hoje';
    } catch (e) {
        hoursEl.textContent = 'Consulte nossos horários';
    }


    const logoEl = document.getElementById('restLogo');
    if (data.logoUrl) {
        logoEl.innerHTML = `<img src="${data.logoUrl}" alt="${data.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        logoEl.style.background = 'none';
    } else {
        logoEl.textContent = data.name.substring(0, 2).toUpperCase();
    }

    const catNav = document.getElementById('catNav');
    const menuContent = document.getElementById('menuContent');

    // Filter categories with active products
    const validCategories = data.categories.filter(cat => cat.products.length > 0);

    if (validCategories.length === 0) {
        menuContent.innerHTML = '<div style="text-align: center; padding: 3rem;">O cardápio está vazio no momento.</div>';
        return;
    }

    // Render Categories Nav
    catNav.innerHTML = validCategories.map((cat, index) => `
        <div class="category-pill ${index === 0 ? 'active' : ''}" onclick="scrollToCategory('cat-${cat.id}', this)">
            ${cat.name}
        </div>
    `).join('');

    // Render Products Sections
    menuContent.innerHTML = validCategories.map(cat => `
        <section class="menu-section" id="cat-${cat.id}">
            <h2 class="section-title">${cat.name}</h2>
            <div class="products-grid">
                ${cat.products.map(prod => `
                    <div class="product-card">
                        ${prod.imageUrl ? `<img src="${prod.imageUrl}" class="product-img" alt="${prod.name}">` : '<div class="product-img" style="background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #ccc;">🖼️</div>'}
                        <div class="product-info">
                            <div>
                                <h3 class="product-title">${prod.name}</h3>
                                <p class="product-desc">${prod.description || ''}</p>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span class="product-price">${prod.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                <button class="btn-add" onclick="addToCart(${JSON.stringify(prod).replace(/"/g, '&quot;')})">+</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `).join('');

    // Pre-save products for search
    window.allProducts = data.categories.flatMap(c => c.products.map(p => ({ ...p, categoryId: c.id })));
}

window.filterProducts = () => {
    const term = document.getElementById('productSearch').value.toLowerCase();
    const sections = document.querySelectorAll('.menu-section');
    const pills = document.querySelectorAll('.category-pill');

    sections.forEach(section => {
        const cards = section.querySelectorAll('.product-card');
        let visibleCount = 0;

        cards.forEach(card => {
            const name = card.querySelector('.product-title').textContent.toLowerCase();
            const matches = name.includes(term);
            card.style.display = matches ? 'flex' : 'none';
            if (matches) visibleCount++;
        });

        section.style.display = visibleCount > 0 ? 'block' : 'none';

        // Sync category pills
        const catId = section.id;
        const pill = document.querySelector(`[onclick*="${catId}"]`);
        if (pill) pill.style.display = visibleCount > 0 ? 'inline-block' : 'none';
    });
};

window.switchTab = (tab, el) => {
    // UI Updates
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        item.style.color = '#888';
    });
    el.classList.add('active');
    el.style.color = 'var(--primary)';

    if (tab === 'home') {
        closeCart();
        toggleMyOrdersModal(false);
    } else if (tab === 'orders') {
        closeCart();
        toggleMyOrdersModal(true);
    } else if (tab === 'cart') {
        toggleMyOrdersModal(false);
        openCart();
    }
};

// MODAL HANDLERS
window.toggleStoreProfileModal = (show) => {
    document.getElementById('profileModal').style.display = show ? 'flex' : 'none';
};

window.toggleMyOrdersModal = (show) => {
    const modal = document.getElementById('myOrdersModal');
    modal.style.display = show ? 'flex' : 'none';
    if (show) refreshMyOrders();
};

async function refreshMyOrders() {
    const list = document.getElementById('myOrdersList');
    const orderIds = JSON.parse(localStorage.getItem('my_orders') || '[]');

    if (orderIds.length === 0) {
        list.innerHTML = '<p class="text-secondary">Nenhum pedido realizado recentemente.</p>';
        return;
    }

    list.innerHTML = '<p class="text-secondary">Atualizando status...</p>';

    try {
        const orders = [];
        for (const id of orderIds) {
            const res = await fetch(`${API_URL}/orders/${id}/status_public`).then(r => r.json());
            if (res.id) orders.push(res);
        }

        list.innerHTML = orders.reverse().map(o => `
            <div class="glass-card" style="margin-bottom: 10px; padding: 10px; border-left: 4px solid ${getStatusColor(o.status)}">
                <div style="display: flex; justify-content: space-between;">
                    <strong>Pedido #${o.orderNumber || o.id}</strong>
                    <span style="color: ${getStatusColor(o.status)}; font-weight: 600;">${translateStatus(o.status)}</span>
                </div>
                <p style="font-size: 0.8rem; margin: 5px 0;">Realizado em: ${new Date(o.createdAt).toLocaleTimeString()}</p>
            </div>
        `).join('');

    } catch (e) {
        list.innerHTML = '<p class="error">Erro ao atualizar status. Tente novamente.</p>';
    }
}

function getStatusColor(status) {
    const colors = { 'pending': '#F59E0B', 'accepted': '#3B82F6', 'preparing': '#8B5CF6', 'ready': '#10B981', 'finished': '#6B7280', 'completed': '#6B7280', 'cancelled': '#EF4444' };
    return colors[status] || '#6B7280';
}

function translateStatus(status) {
    const t = { 'pending': 'Pendente', 'accepted': 'Aceito', 'preparing': 'Em Preparo', 'ready': 'Pronto!', 'finished': 'Finalizado', 'completed': 'Finalizado', 'cancelled': 'Cancelado' };
    return t[status] || status;
}

// CART LOGIC
function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();

    // Simple toast effect
    const btn = event.target;
    const original = btn.textContent;
    btn.textContent = '✓';
    btn.style.background = '#10B981';
    setTimeout(() => {
        btn.textContent = original;
        btn.style.background = '';
    }, 1000);
}

function removeFromCart(id) {
    const index = cart.findIndex(item => item.id === id);
    if (index > -1) {
        if (cart[index].quantity > 1) {
            cart[index].quantity -= 1;
        } else {
            cart.splice(index, 1);
        }
    }
    updateCartUI();
}

function updateCartUI() {
    const count = document.getElementById('cartCount');
    const totalDisp = document.getElementById('cartTotal');

    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
    const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    // Update Bottom Nav Badge
    const navCount = document.getElementById('navCartCount');
    if (totalItems > 0) {
        navCount.textContent = totalItems;
        navCount.style.display = 'block';
    } else {
        navCount.style.display = 'none';
    }

    if (totalItems > 0) {
        count.textContent = totalItems;
        totalDisp.textContent = totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } else {
        closeCart();
    }
}

function openCart() {
    const modal = document.getElementById('cartModal');
    const list = document.getElementById('cartItemsList');
    const modalTotal = document.getElementById('modalTotal');

    list.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div>
                <h4 style="margin: 0;">${item.name}</h4>
                <small style="color: #6B7280;">${item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} un.</small>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <button onclick="removeFromCart(${item.id})" style="border: 1px solid #ddd; background: none; border-radius: 4px; width: 24px;">-</button>
                <span>${item.quantity}</span>
                <button onclick="addToCart(${JSON.stringify(item).replace(/"/g, '&quot;')})" style="border: 1px solid #ddd; background: none; border-radius: 4px; width: 24px;">+</button>
            </div>
        </div>
    `).join('');

    const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    modalTotal.textContent = totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    document.getElementById('cartModal').style.display = 'none';
    document.body.style.overflow = '';
    // Sync Bottom Nav UI if closing via X button
    const navCart = document.getElementById('nav-cart');
    const navHome = document.getElementById('nav-home');
    if (navCart.classList.contains('active')) {
        navCart.classList.remove('active');
        navCart.style.color = '#888';
        navHome.classList.add('active');
        navHome.style.color = 'var(--primary)';
    }
}

window.toggleAddressFields = () => {
    const type = document.getElementById('fulfillmentType').value;
    document.getElementById('addressFields').style.display = type === 'delivery' ? 'block' : 'none';
};

async function checkout() {
    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const fulfillmentType = document.getElementById('fulfillmentType').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const btn = document.getElementById('checkoutBtn');

    if (!name || !phone) {
        alert('Por favor, preencha seu nome e telefone.');
        return;
    }

    // Coletar campos de endereço se for delivery
    let addressData = {};
    if (fulfillmentType === 'delivery') {
        addressData = {
            addressStreet: document.getElementById('custStreet').value.trim(),
            addressNumber: document.getElementById('custNumber').value.trim(),
            addressDistrict: document.getElementById('custDistrict').value.trim(),
            addressComplement: document.getElementById('custComplement').value.trim()
        };
        if (!addressData.addressStreet || !addressData.addressNumber) {
            alert('Por favor, preencha a rua e o número.');
            return;
        }
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Enviando pedido...';

        // 1. Persist in Database
        const orderData = {
            tenantId: restaurant.id,
            customerName: name,
            customerPhone: phone,
            fulfillmentType,
            paymentMethod,
            ...addressData,
            items: cart.map(item => ({
                productId: item.id,
                quantity: item.quantity
            }))
        };

        const response = await fetch(`${API_URL}/orders/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        // 2. Format WhatsApp Message
        const orderNum = result.order.orderNumber || result.order.id;
        const translateFulfillment = { 'delivery': 'Delivery 🚀', 'pickup': 'Retirada 🥡', 'dine_in': 'Consumo no Local 🍽️' };
        const translatePayment = { 'pix': 'Pix 💎', 'card': 'Cartão 💳', 'money': 'Dinheiro 💵' };

        let message = `*Novo Pedido: #${orderNum}*\n`;
        message += `--------------------------\n`;
        message += `*Cliente:* ${name}\n`;
        message += `*Telefone:* ${phone}\n`;
        message += `*Tipo:* ${translateFulfillment[fulfillmentType]}\n`;
        message += `*Pagamento:* ${translatePayment[paymentMethod]}\n\n`;

        if (fulfillmentType === 'delivery') {
            message += `*Endereço de Entrega:*\n`;
            message += `📍 ${addressData.addressStreet}, ${addressData.addressNumber}\n`;
            message += `📍 Bairro: ${addressData.addressDistrict}\n`;
            if (addressData.addressComplement) message += `📍 Comp: ${addressData.addressComplement}\n`;
            message += `\n`;
        }

        message += `*Itens:*\n`;
        cart.forEach(item => {
            message += `- ${item.quantity}x ${item.name} (${(item.price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})\n`;
        });

        const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        message += `\n*TOTAL: ${totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n`;
        message += `--------------------------\n`;
        message += `_Pedido realizado via SmartPede_`;

        // 3. Open WhatsApp
        const encodedMessage = encodeURIComponent(message);
        const whatsappNumber = restaurant.whatsapp || '5511999999999';
        const waLink = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

        window.open(waLink, '_blank');

        // 4. Clear Cart & Save Order ID
        const currentOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
        currentOrders.push(result.order.id);
        localStorage.setItem('my_orders', JSON.stringify(currentOrders));

        cart = [];
        updateCartUI();
        alert('Pedido enviado com sucesso!');
        closeCart();

    } catch (error) {
        alert('Erro ao processar pedido: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Finalizar Pedido pelo WhatsApp';
    }
}
