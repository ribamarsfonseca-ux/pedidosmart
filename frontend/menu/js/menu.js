const API_URL = '/api';
let cart = [];
let restaurant = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get Slug from Subdomain or Hash
    let slug = window.location.hash.substring(1);

    // Check for subdomain (e.g., loja.smartpede.com.br)
    const hostname = window.location.hostname;
    const parts = hostname.split('.');

    // If it's something like loja.smartpede.com.br or loja.localhost
    if (!slug && parts.length >= 2) {
        const firstPart = parts[0];
        if (firstPart !== 'www' && firstPart !== 'smartpede' && firstPart !== 'localhost') {
            slug = firstPart;
        }
    }

    if (!slug) {
        document.body.innerHTML = '<div style="padding: 2rem; text-align: center;"><h1>Loja não encontrada</h1><p>Verifique o link acessado ou use o ID da loja após o #.</p></div>';
        return;
    }

    // 2. Load Restaurant Data
    try {
        const data = await fetch(`${API_URL}/tenants/menu/${slug}`).then(res => res.json());
        if (data.error) throw new Error(data.error);

        restaurant = data;
        renderMenu(data);
        document.getElementById('loading').style.display = 'none';
        checkOrdersStatus(); // Check on load
        setInterval(checkOrdersStatus, 30000); // Polling every 30s
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
    const estimatedTimeEl = document.getElementById('estimatedTimeDisplay');

    // Perfil da Loja
    const populateProfile = () => {
        document.getElementById('restAddressModal').innerHTML = `📍 <b>Endereço:</b> ${data.address || 'Não informado'}`;
        document.getElementById('restPhoneModal').innerHTML = `📞 <b>WhatsApp:</b> ${data.whatsapp || 'Não informado'}`;
        document.getElementById('restSlugModal').innerHTML = `🔗 <b>Link:</b> smartpede.com.br/menu/#${data.slug}`;
        if (data.description) {
            document.getElementById('restDescriptionModal').textContent = data.description;
        } else {
            document.getElementById('restDescriptionModal').style.display = 'none';
        }

        if (data.googleMapsUrl) {
            document.getElementById('restMapsModal').innerHTML = `<a href="${data.googleMapsUrl}" target="_blank" class="btn-action" style="display: inline-block; text-decoration: none; margin-top: 5px;">📍 Abrir no Google Maps</a>`;
        }

        document.getElementById('restPaymentsModal').textContent = data.paymentMethods || 'Pix, Dinheiro, Cartão';

        // Redes Sociais e Contato
        let socialHtml = '';
        if (data.instagramUrl) socialHtml += `<a href="${data.instagramUrl}" target="_blank" style="text-decoration: none; font-size: 1.5rem; margin-right: 15px;">📸</a>`;
        if (data.facebookUrl) socialHtml += `<a href="${data.facebookUrl}" target="_blank" style="text-decoration: none; font-size: 1.5rem; margin-right: 15px;">🌐</a>`;
        if (data.contactEmail) socialHtml += `<p style="font-size: 0.85rem; color: #666; margin-top: 5px;">📧 ${data.contactEmail}</p>`;

        const socialContainer = document.createElement('div');
        socialContainer.style.marginTop = '15px';
        socialContainer.style.borderTop = '1px solid #eee';
        socialContainer.style.paddingTop = '10px';
        socialContainer.innerHTML = '<strong>Redes Sociais e Contato:</strong><div style="margin-top: 5px;">' + (socialHtml || '<p class="text-secondary">Não informado</p>') + '</div>';

        // Append or replace? Let's check the container in index.html
        // I'll insert it before the hours table.
        const profileDetails = document.getElementById('profileDetails');
        if (profileDetails && !document.getElementById('socialLinksModal')) {
            socialContainer.id = 'socialLinksModal';
            profileDetails.insertBefore(socialContainer, document.getElementById('restHoursTableModal').parentNode);
        }

        // Tabela de Horários no Modal
        try {
            if (!data.openingHours || data.openingHours === '[]' || data.openingHours === '{}') {
                document.getElementById('restHoursTableModal').innerHTML = '<p class="text-secondary">Horários não cadastrados.</p>';
            } else {
                const hours = typeof data.openingHours === 'string' ? JSON.parse(data.openingHours) : data.openingHours;
                const dayLabels = { 'mon': 'Segunda', 'tue': 'Terça', 'wed': 'Quarta', 'thu': 'Quinta', 'fri': 'Sexta', 'sat': 'Sábado', 'sun': 'Domingo' };
                const daysOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

                document.getElementById('restHoursTableModal').innerHTML = daysOrder.map(day => {
                    const h = hours[day];
                    if (!h) return `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
                            <span>${dayLabels[day]}</span>
                            <span><span style="color: #ef4444;">Fechado</span></span>
                        </div>
                    `;

                    const formatTime = (t) => {
                        if (!t) return '';
                        const [h, m] = t.split(':');
                        return `${h}h${m}min`;
                    };

                    let text = '';
                    if (h.shift1) text += `${formatTime(h.shift1.start)} às ${formatTime(h.shift1.end)}`;
                    if (h.shift2) text += (text ? ' / ' : '') + `${formatTime(h.shift2.start)} às ${formatTime(h.shift2.end)}`;

                    if (!text && h.start && h.end) text = `${formatTime(h.start)} às ${formatTime(h.end)}`;

                    return `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
                            <span style="text-transform: capitalize;">${dayLabels[day].toLowerCase()}:</span>
                            <span style="font-size: 0.85rem;">${text || '<span style="color: #ef4444;">Fechado</span>'}</span>
                        </div>
                    `;
                }).join('');
            }
        } catch (e) {
            console.error('Erro ao renderizar horários no modal:', e);
            document.getElementById('restHoursTableModal').textContent = 'Horários não disponíveis no momento.';
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

            const isOpenInShift = (shift, isToday) => {
                if (!shift) return false;
                const start = parseInt(shift.start.replace(':', ''));
                const end = parseInt(shift.end.replace(':', ''));

                if (isToday) {
                    if (end < start) { // Crosses midnight
                        return currentTime >= start;
                    }
                    return currentTime >= start && currentTime <= end;
                } else { // Yesterday (Early morning check)
                    if (end < start) { // Crosses midnight
                        return currentTime <= end;
                    }
                    return false;
                }
            };

            const tHours = hours[today] || {};
            const yHours = hours[yesterday] || {};

            // Shifts Support (v5)
            if (tHours.shift1 && isOpenInShift(tHours.shift1, true)) return true;
            if (tHours.shift2 && isOpenInShift(tHours.shift2, true)) return true;
            if (yHours.shift1 && isOpenInShift(yHours.shift1, false)) return true;
            if (yHours.shift2 && isOpenInShift(yHours.shift2, false)) return true;

            // Legacy Support (v4)
            if (tHours.start && !tHours.shift1) {
                const start = parseInt(tHours.start.replace(':', ''));
                const end = parseInt(tHours.end.replace(':', ''));
                if (end < start) {
                    if (currentTime >= start) return true;
                } else {
                    if (currentTime >= start && currentTime <= end) return true;
                }
            }
            if (yHours.start && !yHours.shift1) {
                const start = parseInt(yHours.start.replace(':', ''));
                const end = parseInt(yHours.end.replace(':', ''));
                if (end < start && currentTime <= end) return true;
            }

            return false;
        } catch (e) {
            console.error('Erro ao validar horário', e);
            return false;
        }
    }

    const isOpen = checkOpen();
    statusEl.textContent = isOpen ? 'Aberto' : 'Fechado';
    statusEl.style.background = isOpen ? '#10B981' : '#EF4444';

    // Horário amigável (v5 turnos)
    try {
        const hours = JSON.parse(data.openingHours);
        const today = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
        const h = hours[today] || {};
        const s1 = h.shift1 || (h.start ? { start: h.start, end: h.end } : null);
        const s2 = h.shift2;

        let text = h.start ? `${h.start} - ${h.end}` : 'Fechado hoje';
        if (h.shift1) text = `${h.shift1.start} às ${h.shift1.end}${h.shift2 ? ` / ${h.shift2.start} às ${h.shift2.end}` : ''}`;

        hoursEl.textContent = text;
        if (estimatedTimeEl && data.estimatedTime) {
            estimatedTimeEl.textContent = `⏱️ ${data.estimatedTime}`;
            estimatedTimeEl.style.display = 'block';
        }
        // v5 Status Bar White Text
        statusEl.innerHTML = `<span style="color: white;">${isOpen ? 'Aberto' : 'Fechado'}</span>`;
        statusEl.style.background = isOpen ? '#10B981' : '#EF4444';
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
        const searchInput = document.getElementById('productSearch');
        if (searchInput) {
            searchInput.value = '';
            filterProducts();
        }
        closeCart();
        toggleMyOrdersModal(false);
        toggleStoreProfileModal(false); // New: Close profile on home
    } else if (tab === 'orders') {
        closeCart();
        toggleStoreProfileModal(false);
        toggleMyOrdersModal(true);
    } else if (tab === 'cart') {
        toggleMyOrdersModal(false);
        toggleStoreProfileModal(false);
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
            <div class="glass-card" style="margin-bottom: 15px; padding: 15px; border-left: 5px solid ${getStatusColor(o.status)}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Pedido #${o.orderNumber || o.id}</strong>
                    <span style="color: white; background: ${getStatusColor(o.status)}; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${translateStatus(o.status)}</span>
                </div>
                <p style="font-size: 0.8rem; margin: 8px 0; color: #666;">Realizado em: ${new Date(o.createdAt).toLocaleString()}</p>
                <div style="font-size: 0.85rem; margin-bottom: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                    ${o.items.map(i => `<div>${i.quantity}x ${i.product.name}</div>`).join('')}
                    <div style="margin-top: 5px; font-weight: 700;">Total: ${o.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <button class="btn-action" style="width: 100%; font-size: 0.8rem;" onclick="repeatOrder(${o.id})">🔗 Repetir Pedido</button>
                    <button class="btn-action" style="width: 100%; font-size: 0.8rem; background: #eee; border: none; color: #333;" onclick="alert('Funcionalidade de detalhes em breve!')">📄 Detalhes</button>
                </div>
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
    if (navCount) {
        navCount.textContent = totalItems;
        navCount.style.display = totalItems > 0 ? 'block' : 'none';
    }

    // v5 Floating Bar Above Nav
    const v5Bar = document.getElementById('cartBarAboveNav');
    if (v5Bar) {
        v5Bar.style.display = totalItems > 0 ? 'block' : 'none';
        document.getElementById('floatingCartItems').textContent = totalItems;
        document.getElementById('floatingCartTotal').textContent = totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    if (totalItems > 0) {
        if (count) count.textContent = totalItems;
        const modalTotal = document.getElementById('modalTotal');
        if (modalTotal) modalTotal.textContent = totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } else {
        closeCart();
    }

    // Check orders on every cart update too
    checkOrdersStatus();
}

async function checkOrdersStatus() {
    const orderIds = JSON.parse(localStorage.getItem('my_orders') || '[]');
    const statusDot = document.getElementById('orderStatusDot');
    if (!statusDot) return;

    if (orderIds.length === 0) {
        statusDot.style.display = 'none';
        return;
    }

    try {
        let hasActive = false;
        let lastStatus = 'pending';

        // Check only the most recent order for the dot color
        const lastId = orderIds[orderIds.length - 1];
        const res = await fetch(`${API_URL}/orders/${lastId}/status_public`).then(r => r.json());

        if (res.id && res.status !== 'finished' && res.status !== 'cancelled' && res.status !== 'completed') {
            hasActive = true;
            lastStatus = res.status;
        }

        if (hasActive) {
            statusDot.style.display = 'block';
            statusDot.style.background = getStatusColor(lastStatus);
        } else {
            statusDot.style.display = 'none';
        }
    } catch (e) {
        console.error('Error checking orders', e);
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

function getMinOrderValue(type) {
    if (!restaurant) return 0;
    if (type === 'delivery') return restaurant.minOrderDelivery || 0;
    if (type === 'pickup') return restaurant.minOrderPickup || 0;
    return restaurant.minOrderDineIn || 0;
}

function translateFulfillment(type) {
    const t = { 'delivery': 'Delivery', 'pickup': 'Retirada', 'dine_in': 'Consumo Local' };
    return t[type] || type;
}

window.repeatOrder = async (id) => {
    try {
        const o = await fetch(`${API_URL}/orders/${id}/status_public`).then(r => r.json());
        if (!o.items) return;

        cart = o.items.map(i => ({
            id: i.product.id,
            name: i.product.name,
            price: i.product.price,
            imageUrl: i.product.imageUrl,
            quantity: i.quantity
        }));

        updateCartUI();
        alert('Items adicionados ao carrinho!');
        switchTab('cart', document.getElementById('nav-cart'));
    } catch (e) {
        alert('Erro ao repetir pedido.');
    }
};

window.toggleAddressFields = () => {
    const type = document.getElementById('fulfillmentType').value;
    const fields = document.getElementById('addressFields');
    if (fields) fields.style.display = type === 'delivery' ? 'block' : 'none';

    // Update Modal Total dynamically with Delivery Fee
    const modalTotal = document.getElementById('modalTotal');
    const itemsPrice = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const fee = (type === 'delivery' && restaurant.deliveryFee) ? restaurant.deliveryFee : 0;

    if (modalTotal) {
        modalTotal.innerHTML = fee > 0
            ? `R$ ${(itemsPrice).toFixed(2).replace('.', ',')} <small class="text-secondary">+ R$ ${fee.toFixed(2).replace('.', ',')} (entrega)</small>`
            : (itemsPrice + fee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
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

    const itemsPrice = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const minVal = getMinOrderValue(fulfillmentType);
    if (itemsPrice < minVal) {
        alert(`O valor mínimo dos itens para ${translateFulfillment(fulfillmentType)} é ${minVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Adicione mais itens ao seu carrinho.`);
        return;
    }

    const fee = (fulfillmentType === 'delivery' && restaurant.deliveryFee) ? restaurant.deliveryFee : 0;
    const totalPrice = itemsPrice + fee;

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
            totalAmount: totalPrice, // explicit total sent to DB just in case
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
        const localTranslateFulfillment = { 'delivery': 'Delivery 🚀', 'pickup': 'Retirada 🥡', 'dine_in': 'Consumo no Local 🍽️' };
        const localTranslatePayment = { 'pix': 'Pix 💎', 'card': 'Cartão 💳', 'money': 'Dinheiro 💵' };

        let message = `*Novo Pedido: #${orderNum}*\n`;
        message += `--------------------------\n`;
        message += `*Cliente:* ${name}\n`;
        message += `*Telefone:* ${phone}\n`;
        message += `*Tipo:* ${localTranslateFulfillment[fulfillmentType]}\n`;
        message += `*Pagamento:* ${localTranslatePayment[paymentMethod]}\n\n`;

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

        message += `\n*Subtotal:* ${itemsPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
        if (fee > 0) message += `*Taxa de Entrega:* ${fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
        message += `*TOTAL: ${totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n`;
        message += `--------------------------\n`;
        message += `*Acompanhe seu pedido aqui:* \n🔗 ${window.location.host}/menu/#${restaurant.slug}\n`;
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
