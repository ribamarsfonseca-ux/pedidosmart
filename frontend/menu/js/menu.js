const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api';

// Global State
let cart = [];
let restaurant = null;
let userLocation = JSON.parse(localStorage.getItem('userLocation')) || null;
let calculatedDeliveryFee = 0;
let appliedCoupon = null; // { code, type, value }
let tableNumber = null;
let map = null;
let marker = null;
let favorites = JSON.parse(localStorage.getItem('locationFavorites')) || { home: null, work: null };
let geoapifyApiKey = ''; // Loaded from public configs

document.addEventListener('DOMContentLoaded', async () => {
    await loadPublicConfigs();
    await loadTenantData();
    initLocationUI();
});

async function loadPublicConfigs() {
    try {
        const res = await fetch(`${API_URL}/tenants/public-configs`).then(r => r.json());
        if (res.geoapifyApiKey) {
            geoapifyApiKey = res.geoapifyApiKey;
        }
        // Cache dev info for error screen
        window.devConfigs = res;
    } catch (e) {
        console.error('Erro ao carregar configs públicas');
    }
}

function initLocationUI() {
    const label = document.getElementById('currentAddressLabel');
    const checkoutLabel = document.getElementById('checkoutAddressLabel');
    if (userLocation && userLocation.address) {
        label.textContent = userLocation.address;
        if (checkoutLabel) checkoutLabel.textContent = userLocation.address;
        updateDeliveryFee();
    }
}

async function loadTenantData() {
    // 1. Get Slug from Subdomain or Hash
    let hash = window.location.hash.substring(1);
    let slug = hash.split('?')[0];

    // Parse query params from hash
    const params = new URLSearchParams(hash.split('?')[1] || '');
    tableNumber = params.get('table');

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

        // Auto-select Table if present in URL
        if (tableNumber) {
            setTimeout(() => {
                const ft = document.getElementById('fulfillmentType');
                if (ft) {
                    ft.value = 'dine_in';
                    ft.disabled = true; // Lock it
                    toggleAddressFields(); // Update UI
                    // Inform user
                    const cartFooter = document.querySelector('.cart-footer');
                    if (cartFooter) {
                        const alert = document.createElement('div');
                        alert.style.cssText = 'background: #f0fdf4; color: #166534; padding: 10px; border-radius: 8px; margin-bottom: 10px; font-size: 0.85rem; border: 1px solid #bbf7d0;';
                        alert.innerHTML = `<strong>📍 Atendimento na Mesa ${tableNumber}</strong><br>Seu pedido será entregue diretamente nesta mesa.`;
                        cartFooter.prepend(alert);
                    }
                }
            }, 500);
        }

        document.getElementById('loading').style.display = 'none';
        checkOrdersStatus(); // Check on load
        setInterval(checkOrdersStatus, 30000); // Polling every 30s
    } catch (error) {
        console.error(error);

        const devData = window.devConfigs || {};
        const devPhone = devData.devPhone || '';
        const devEmail = devData.devEmail || '';
        const devName = devData.devName || 'Suporte SmartPede';
        const waLink = devPhone ? `https://wa.me/${devPhone.replace(/\D/g, '')}?text=Olá, o cardápio da loja ${slug} está indisponível.` : null;

        document.getElementById('loading').innerHTML = `
            <div style="text-align:center; padding: 4rem 1.5rem; font-family: 'Inter', sans-serif; background: #fff; min-height: 100vh;">
                <div style="font-size: 4.5rem; margin-bottom: 1.5rem; animation: pulse 2s infinite;">🔒</div>
                <h2 style="color:#0f172a; margin-bottom:1rem; font-size: 1.5rem; font-weight: 800;">Loja Temporariamente Indisponível</h2>
                <p style="color:#64748b; max-width:320px; margin: 0 auto 2.5rem; line-height: 1.6; font-size: 0.95rem;">
                    Esta loja está passando por manutenção ou aguarda regularização financeira.<br>
                    Entre em contato para mais informações.
                </p>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:20px; padding:1.5rem; display:inline-block; text-align:left; width:100%; max-width:320px;">
                    <p style="font-weight:800; margin:0 0 15px; color:#0f172a; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">Suporte Técnico:</p>
                    <p style="font-weight:700; color:#475569; margin-bottom: 5px;">${devName}</p>
                    ${devPhone ? `<a href="${waLink}" target="_blank" style="display:flex; align-items:center; gap:8px; color:#25d366; text-decoration:none; font-weight:700; margin-bottom:10px;">💬 WhatsApp Suporte</a>` : ''}
                    ${devEmail ? `<p style="margin:4px 0; color:#64748b; font-size: 0.85rem;">📧 ${devEmail}</p>` : ''}
                </div>
                <style>
                    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
                </style>
            </div>
        `;
    }
}

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

    // Desativar Delivery se configurado
    if (data.acceptDelivery === false) {
        const delOption = document.querySelector('#fulfillmentType option[value="delivery"]');
        if (delOption) delOption.remove();
    }

    // Garante que a URL da imagem seja absoluta (resolve erro de links colados sem http://)
    const formatImageUrl = (url) => {
        if (!url) return '';
        url = url.trim();
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image')) {
            return url;
        }
        return 'https://' + url;
    };


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
                const dayLabels = { 'mon': 'Seg:', 'tue': 'Ter:', 'wed': 'Qua:', 'thu': 'Qui:', 'fri': 'Sex:', 'sat': 'Sab:', 'sun': 'Dom:' };
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
                        return `${h}:${m}h`;
                    };

                    let text = '';
                    if (h.shift1) text += `${formatTime(h.shift1.start)} às ${formatTime(h.shift1.end)}`;
                    if (h.shift2) text += (text ? ' / ' : '') + `${formatTime(h.shift2.start)} às ${formatTime(h.shift2.end)}`;

                    if (!text && h.start && h.end) text = `${formatTime(h.start)} às ${formatTime(h.end)}`;

                    return `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
                            <span style="font-weight: 500; font-size: 0.85rem; color: #4B5563;">${dayLabels[day]}</span>
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
        const todayIdx = new Date().getDay();
        const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const today = daysMap[todayIdx];
        const h = hours[today] || {};
        const s1 = h.shift1 || (h.start ? { start: h.start, end: h.end } : null);
        const s2 = h.shift2;

        const formatTime = (t) => {
            if (!t) return '';
            const [hh, mm] = t.split(':');
            return `${hh.padStart(2, '0')}:${mm}h`;
        };

        let text = h.start ? `${formatTime(h.start)} - ${formatTime(h.end)}` : 'Fechado hoje';
        if (h.shift1) {
            text = `${formatTime(h.shift1.start)} - ${formatTime(h.shift1.end)}`;
            if (h.shift2) text += ` | ${formatTime(h.shift2.start)} - ${formatTime(h.shift2.end)}`;
        }

        // Horário ao lado do status, mesma linha, fonte menor para mobile
        hoursEl.textContent = ` ${text}`;
        hoursEl.style.fontSize = '0.78rem';
        hoursEl.style.color = '#4B5563';
        hoursEl.style.fontWeight = '500';
        hoursEl.style.whiteSpace = 'nowrap';
        hoursEl.style.overflow = 'hidden';
        hoursEl.style.textOverflow = 'ellipsis';

        // v5 Status Bar White Text
        statusEl.innerHTML = `<span style="color: white;">${isOpen ? 'Aberto' : 'Fechado'}</span>`;
        statusEl.style.background = isOpen ? '#10B981' : '#EF4444';
        statusEl.style.display = 'inline-block';
        statusEl.style.marginRight = '5px';

        // Remover tempo do cabeçalho
        if (estimatedTimeEl) estimatedTimeEl.style.display = 'none';

    } catch (e) {
        console.error('Erro ao renderizar horários:', e);
        hoursEl.textContent = ' • Consulte nossos horários';
    }

    // Logo
    const logoEl = document.getElementById('restLogo');
    if (data.logoUrl) {
        logoEl.innerHTML = `<img src="${formatImageUrl(data.logoUrl)}" alt="${data.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.onerror=null; this.outerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#eee;font-weight:bold;color:#666;border-radius:50%;\\'>' + '${data.name}'.charAt(0).toUpperCase() + '</div>';">`;
    } else {
        logoEl.innerHTML = data.name.charAt(0).toUpperCase();
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
                ${cat.products.map(prod => {
        const isSoldOut = prod.useStock && (prod.stockQuantity || 0) <= 0;
        return `
                    <div class="product-card ${isSoldOut ? 'sold-out' : ''}" onclick="${isSoldOut ? '' : `openProductDetail(${JSON.stringify(prod).replace(/"/g, '&quot;')})`}">
                        <div style="position: relative;">
                            ${prod.imageUrl ? `<img src="${formatImageUrl(prod.imageUrl)}" class="product-img" alt="${prod.name}" onerror="this.onerror=null; this.outerHTML='<div class=\\'product-img\\' style=\\'background: #f3f4f6; display: flex; text-align: center; align-items: center; justify-content: center; color: #999; font-size: 0.7rem; padding: 4px;\\'>Link não é imagem</div>';">` : '<div class="product-img" style="background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #ccc;">🖼️</div>'}
                            ${isSoldOut ? '<div style="position: absolute; inset:0; background: rgba(255,255,255,0.7); display:flex; align-items:center; justify-content:center;"><span style="background:#ef4444; color:white; padding:4px 10px; border-radius:4px; font-weight:700; font-size:0.75rem;">ESGOTADO</span></div>' : ''}
                        </div>
                        <div class="product-info">
                            <div>
                                <h3 class="product-title">${prod.name}</h3>
                                <p class="product-desc">${prod.description || ''}</p>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span class="product-price">${prod.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                <button class="btn-add" ${isSoldOut ? 'disabled' : ''} onclick="event.stopPropagation(); ${isSoldOut ? '' : `openProductDetail(${JSON.stringify(prod).replace(/"/g, '&quot;')})`}">
                                    ${isSoldOut ? 'Off' : '+'}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
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

// Scroll to category section and mark active pill
window.scrollToCategory = (catId, pill) => {
    const section = document.getElementById(catId);
    if (!section) return;
    document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

// PRODUCT DETAIL & ADDONS LOGIC
let currentBaseProduct = null;
let detailQuantity = 1;

window.openProductDetail = (product) => {
    currentBaseProduct = product;
    detailQuantity = 1;
    selectedAddonState = {}; // Resetar estado ao abrir novo produto
    document.getElementById('detailQuantity').textContent = detailQuantity;
    document.getElementById('detailProductName').textContent = product.name;
    document.getElementById('detailProductDesc').textContent = product.description || '';

    const imgContainer = document.getElementById('detailProductImgContainer');
    if (product.imageUrl) {
        imgContainer.innerHTML = `<img src="${product.imageUrl}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px; margin-bottom: 10px;">`;
        imgContainer.style.display = 'block';
    } else {
        imgContainer.style.display = 'none';
    }

    renderDetailAddons(product.addonGroups || []);
    updateDetailTotal();

    const obsField = document.getElementById('productObservation');
    if (obsField) obsField.value = '';

    document.getElementById('productDetailModal').style.display = 'flex';

    // Configurar botão de adicionar
    const btn = document.getElementById('addWithAddonsBtn');
    btn.onclick = () => addSelectedProductToCart();
};

window.closeProductDetailModal = () => {
    document.getElementById('productDetailModal').style.display = 'none';
    currentBaseProduct = null;
};

function renderDetailAddons(groups) {
    const container = document.getElementById('detailAddonGroups');
    if (!groups || groups.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = groups.map(g => {
        let instruction = '';
        if (g.minChoices === g.maxChoices) {
            instruction = `Escolha exatamente ${g.minChoices}`;
        } else if (g.minChoices > 0) {
            instruction = `Escolha de ${g.minChoices} a ${g.maxChoices}`;
        } else {
            instruction = `Escolha até ${g.maxChoices}`;
        }

        return `
            <div class="addon-group" style="margin-bottom: 24px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin:0; font-size: 1rem; color: #1e293b; font-weight: 700;">${g.name}</h4>
                        <p style="margin: 2px 0 0; font-size: 0.75rem; color: #64748b; font-weight: 500;">${instruction}</p>
                    </div>
                    ${g.isRequired ? '<span style="background: #fee2e2; color: #ef4444; font-size: 0.6rem; font-weight: 800; padding: 4px 8px; border-radius: 6px; text-transform: uppercase;">Obrigatório</span>' : ''}
                </div>
                <div class="addon-options" id="options-group-${g.id}" style="padding: 0 16px; background: white;">
                    ${g.addons.map(a => {
            const currentQty = selectedAddonState[a.id] || 0;
            const isSelected = currentQty > 0;
            return `
                        <div id="addon-item-${a.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid #f1f5f9; background: ${isSelected ? '#fff8f1' : 'white'};">
                            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                                <span class="addon-name" style="font-size: 0.95rem; color: ${isSelected ? 'var(--primary)' : '#334155'}; font-weight: ${isSelected ? '700' : '600'};">${a.name}</span>
                                <span style="font-size: 0.78rem; color: #94a3b8; font-weight: 500;">+ ${a.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div class="addon-qty-wrapper" style="display: flex; align-items: center; gap: 8px; background: ${isSelected ? 'var(--primary)' : '#f1f5f9'}; padding: 3px; border-radius: 100px; border: 1px solid ${isSelected ? 'var(--primary)' : 'transparent'};">
                                <button class="addon-minus-btn" onclick="changeAddonQty(${g.id}, ${a.id}, -1, ${g.maxChoices})" 
                                        style="width: 28px; height: 28px; border: none; background: ${isSelected ? 'rgba(255,255,255,0.2)' : 'white'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; cursor: pointer; color: ${isSelected ? 'white' : 'var(--primary)'}; font-weight: 800;">−</button>
                                <span class="addon-qty-display" style="font-size: 0.95rem; font-weight: 800; min-width: 18px; text-align: center; color: ${isSelected ? 'white' : '#334155'};">${currentQty}</span>
                                <button onclick="changeAddonQty(${g.id}, ${a.id}, 1, ${g.maxChoices})" 
                                        style="width: 28px; height: 28px; border: none; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; cursor: pointer; color: var(--primary); font-weight: 800; box-shadow: 0 1px 3px rgba(0,0,0,0.12);">+</button>
                            </div>
                        </div>`;
        }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

let selectedAddonState = {}; // { addonId: quantity }

window.changeAddonQty = (groupId, addonId, delta, maxGroup) => {
    const currentQty = selectedAddonState[addonId] || 0;
    const newQty = Math.max(0, currentQty + delta);

    // Validar máximo do grupo
    if (delta > 0) {
        // Encontrar todos os IDs dos adicionais deste grupo
        const group = currentBaseProduct.addonGroups.find(g => g.id === groupId);
        const groupAddonIds = group.addons.map(a => a.id);
        const totalInGroup = groupAddonIds.reduce((sum, id) => sum + (selectedAddonState[id] || 0), 0);

        if (totalInGroup >= maxGroup) {
            alert(`Você pode escolher no máximo ${maxGroup} itens neste grupo.`);
            return;
        }
    }

    selectedAddonState[addonId] = newQty;

    // Re-renderizar o item específico para atualizar estado visual (cor, contador)
    // Encontrar o adicional e re-injetar o HTML do bloco
    const group = currentBaseProduct.addonGroups.find(g => g.id === groupId);
    if (group) {
        const addon = group.addons.find(a => a.id === addonId);
        if (addon) {
            const isSelected = newQty > 0;
            const container = document.getElementById(`addon-item-${addonId}`);
            if (container) {
                container.style.backgroundColor = isSelected ? '#fff8f1' : '';
                const nameSpan = container.querySelector('.addon-name');
                if (nameSpan) {
                    nameSpan.style.color = isSelected ? 'var(--primary)' : '#334155';
                    nameSpan.style.fontWeight = isSelected ? '700' : '600';
                }
                const qtyWrapper = container.querySelector('.addon-qty-wrapper');
                if (qtyWrapper) {
                    qtyWrapper.style.background = isSelected ? 'var(--primary)' : '#f1f5f9';
                    qtyWrapper.style.borderColor = isSelected ? 'var(--primary)' : 'transparent';
                }
                const minusBtn = container.querySelector('.addon-minus-btn');
                if (minusBtn) {
                    minusBtn.style.background = isSelected ? 'rgba(255,255,255,0.2)' : 'white';
                    minusBtn.style.color = isSelected ? 'white' : 'var(--primary)';
                }
                const qtySpan = container.querySelector('.addon-qty-display');
                if (qtySpan) {
                    qtySpan.textContent = newQty;
                    qtySpan.style.color = isSelected ? 'white' : '#334155';
                }
            }
        }
    }

    updateDetailTotal();
};

window.validateAddonChoice = (groupId, max, element) => {
    if (max === 1) return; // Radio handling is native
    const checked = document.querySelectorAll(`input[name="group-${groupId}"]:checked`);
    if (checked.length > max) {
        element.checked = false;
        alert(`Você pode escolher no máximo ${max} opções para este grupo.`);
    }
};

window.changeDetailQty = (delta) => {
    detailQuantity = Math.max(1, detailQuantity + delta);
    document.getElementById('detailQuantity').textContent = detailQuantity;
    updateDetailTotal();
};

window.updateDetailTotal = () => {
    if (!currentBaseProduct) return;
    let total = currentBaseProduct.price;

    // Calcular por quantidade selecionada no state
    if (Object.keys(selectedAddonState).length > 0) {
        currentBaseProduct.addonGroups.forEach(g => {
            g.addons.forEach(a => {
                const qty = selectedAddonState[a.id] || 0;
                total += (a.price * qty);
            });
        });
    }

    const subtotal = total * detailQuantity;
    document.getElementById('detailTotalPrice').textContent = subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

function addSelectedProductToCart() {
    // Validar obrigatórios
    const groups = currentBaseProduct.addonGroups || [];
    const finalAddons = [];

    for (const g of groups) {
        const groupAddonIds = g.addons.map(a => a.id);
        const totalInGroup = groupAddonIds.reduce((sum, id) => sum + (selectedAddonState[id] || 0), 0);

        if (g.isRequired && totalInGroup < g.minChoices) {
            alert(`Por favor, selecione pelo menos ${g.minChoices} opção(ões) em "${g.name}"`);
            return;
        }

        // Adicionar itens finais conforme a quantidade
        g.addons.forEach(a => {
            const qty = selectedAddonState[a.id] || 0;
            for (let i = 0; i < qty; i++) {
                finalAddons.push({
                    id: a.id,
                    name: a.name,
                    price: a.price
                });
            }
        });
    }

    const observation = document.getElementById('productObservation')?.value.trim() || '';

    // No SmartPede, itens com adicionais ou observações diferentes devem ser entradas separadas no carrinho
    const addonIdsKey = finalAddons.map(a => a.id).sort().join('-');
    const cartItemId = `${currentBaseProduct.id}-${addonIdsKey}-${btoa(observation).substring(0, 10)}`;

    const cartItem = {
        cartItemId,
        id: currentBaseProduct.id,
        name: currentBaseProduct.name,
        price: currentBaseProduct.price,
        imageUrl: currentBaseProduct.imageUrl,
        quantity: detailQuantity,
        addons: finalAddons,
        observation,
        totalItemPrice: currentBaseProduct.price + finalAddons.reduce((acc, a) => acc + a.price, 0)
    };

    const existingIndex = cart.findIndex(item => item.cartItemId === cartItemId);
    if (existingIndex > -1) {
        cart[existingIndex].quantity += detailQuantity;
    } else {
        cart.push(cartItem);
    }

    updateCartUI();
    closeProductDetailModal();

    // Abrir carrinho automaticamente para confirmal
    openCart();
}

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
                    ${(o.status === 'pending' || o.status === 'accepted') && !o.cancellationRequested
                ? `<button class="btn-action" style="width: 100%; font-size: 0.8rem; background: #fee2e2; border-color: #ef4444; color: #ef4444;" onclick="solicitarCancelamento(${o.id})">🚫 Cancelar</button>`
                : `<button class="btn-action" style="width: 100%; font-size: 0.8rem; background: #eee; border: none; color: #333;" onclick="alert('${o.cancellationRequested ? 'Cancelamento solicitado.' : 'Acompanhe seu pedido!'}')">📄 Status</button>`}
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
    if (product.addonGroups && product.addonGroups.length > 0) {
        openProductDetail(product);
        return;
    }

    // Fallback para produtos sem adicionais (comportamento antigo mantido/melhorado)
    const cartItemId = `${product.id}`;
    const existing = cart.find(item => item.cartItemId === cartItemId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            cartItemId,
            id: product.id,
            name: product.name,
            price: product.price,
            imageUrl: product.imageUrl,
            quantity: 1,
            addons: [],
            totalItemPrice: product.price
        });
    }
    updateCartUI();

    // Simple toast effect
    const btn = event.target;
    if (btn && btn.classList.contains('btn-add')) {
        const original = btn.textContent;
        btn.textContent = '✓';
        btn.style.background = '#10B981';
        setTimeout(() => {
            btn.textContent = original;
            btn.style.background = '';
        }, 1000);
    }
}

function removeFromCart(cartItemId) {
    const index = cart.findIndex(item => item.cartItemId === cartItemId);
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
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
    const totalPrice = cart.reduce((acc, item) => acc + (item.totalItemPrice * item.quantity), 0);

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

    // Atualiza a lista visual do modal e botões de +/- em tempo real
    renderCartItemsList();

    if (totalItems > 0) {
        const count = document.getElementById('cartCount');
        if (count) count.textContent = totalItems;
        updateCartTotalUI();
    } else {
        closeCart();
    }
}

function renderCartItemsList() {
    const list = document.getElementById('cartItemsList');
    if (!list) return;

    if (cart.length === 0) {
        list.innerHTML = '<p class="text-secondary" style="text-align:center; padding: 20px;">Carrinho vazio</p>';
        return;
    }

    list.innerHTML = cart.map(item => `
        <div class="cart-item" style="display: flex; gap: 12px; padding: 15px 0; border-bottom: 1px solid #f1f5f9; align-items: flex-start;">
            <div style="flex: 1;">
                <h4 style="margin: 0; font-size: 0.95rem; color: #1e293b;">${item.name}</h4>
                ${item.addons && item.addons.length > 0 ? `
                    <p style="margin: 4px 0; font-size: 0.8rem; color: #64748b; line-height: 1.2;">
                        ${item.addons.map(a => `+ ${a.name}`).join('<br>')}
                    </p>
                ` : ''}
                ${item.observation ? `
                    <p style="margin: 4px 0; font-size: 0.75rem; color: #f59e0b; font-style: italic;">
                        Obs: ${item.observation}
                    </p>
                ` : ''}
                <div style="margin-top: 8px; font-weight: 700; color: var(--primary);">
                    ${(item.totalItemPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
            </div>
            <div class="quantity-controls" style="display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 4px 8px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <button onclick="removeFromCart('${item.cartItemId}')" style="border:none; background:none; font-size: 1.1rem; color: var(--primary); font-weight: 800; cursor:pointer;">-</button>
                <span style="font-size: 0.9rem; font-weight: 700;">${item.quantity}</span>
                <button onclick="addOneMore('${item.cartItemId}')" style="border:none; background:none; font-size: 1.1rem; color: var(--primary); font-weight: 800; cursor:pointer;">+</button>
            </div>
        </div>
    `).join('');
}

// Helper to increment item in cart
window.addOneMore = (cartItemId) => {
    const item = cart.find(i => i.cartItemId === cartItemId);
    if (item) {
        item.quantity += 1;
        updateCartUI();
    }
};
// Check orders on every cart update too
checkOrdersStatus();

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

    // Inserir Tempos Estimados ao lado de "Meu Pedido" (Refinado)
    const cartHeader = modal.querySelector('h2');
    if (cartHeader && restaurant) {
        let timesHtml = '';
        if (restaurant.estimatedTimePickup) timesHtml += `<span style="font-size: 0.75rem; color: #4B5563; background: #F3F4F6; padding: 4px 8px; border-radius: 6px; margin-left: 15px;">🛍️ ${restaurant.estimatedTimePickup}</span>`;
        if (restaurant.estimatedTimeDelivery) timesHtml += `<span style="font-size: 0.75rem; color: #4B5563; background: #F3F4F6; padding: 4px 8px; border-radius: 6px; margin-left: 8px;">🛵 ${restaurant.estimatedTimeDelivery}</span>`;
        if (timesHtml) {
            cartHeader.innerHTML = `Meu Pedido ${timesHtml}`;
            cartHeader.style.display = 'flex';
            cartHeader.style.alignItems = 'center';
            cartHeader.style.flexWrap = 'wrap';
            cartHeader.style.gap = '5px';
        }
    }

    renderCartItemsList(); // A lista é gerada por essa função agora
    updateCartTotalUI(); // Centralizar total

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
        alert('Itens adicionados ao carrinho!');
        switchTab('cart', document.getElementById('nav-cart'));
    } catch (e) {
        alert('Erro ao repetir pedido.');
    }
};

window.toggleAddressFields = async () => {
    const type = document.getElementById('fulfillmentType').value;
    const fields = document.getElementById('addressFields');
    if (fields) {
        fields.style.display = type === 'delivery' ? 'block' : 'none';
        console.log('Toggle Delivery Fields:', type, fields.style.display);
    }

    if (type === 'delivery') {
        if (userLocation) {
            updateDeliveryFee();
            // Preencher campos se vazios
            if (document.getElementById('custStreet') && !document.getElementById('custStreet').value) {
                const parts = userLocation.address.split(',');
                document.getElementById('custStreet').value = parts[0]?.trim() || '';
                document.getElementById('custNumber').value = parts[1]?.trim() || '';
                document.getElementById('custDistrict').value = parts[2]?.trim() || '';
            }
        } else {
            // Se não tem localização, abre o modal automaticamente para facilitar
            openLocationModal();
        }
    } else {
        calculatedDeliveryFee = 0;
        updateCartTotalUI();
    }
};


window.openLocationModal = () => {
    if (userLocation) tempLocation = { ...userLocation };

    const modal = document.getElementById('locationModal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        initLocationMap();

        const modalCity = document.getElementById('modalCity');
        const modalState = document.getElementById('modalState');

        // Se o modal estiver vazio, tenta preencher com dados da loja como sugestão
        if (modalCity && modalState && !modalCity.value && restaurant && restaurant.address) {
            const parts = restaurant.address.split(',');
            // Ex: "Rua X, Bairro, Cidade - UF" ou "Cidade - UF"
            const lastPart = parts[parts.length - 1].trim();
            if (lastPart.includes('-')) {
                const subParts = lastPart.split('-');
                const state = subParts[subParts.length - 1].trim().substring(0, 2).toUpperCase();
                const city = subParts[subParts.length - 2].trim();

                if (!modalState.value) modalState.value = state;
                if (!modalCity.value) modalCity.value = city;
            } else {
                modalCity.value = restaurant.city || "";
                modalState.value = restaurant.state || "";
            }
        }

        // Se o cliente já tiver localização salva, prioriza ela nos campos do modal
        if (userLocation) {
            if (userLocation.state && modalState) modalState.value = userLocation.state;
            if (userLocation.city && modalCity) modalCity.value = userLocation.city;
            if (userLocation.district) document.getElementById('modalDistrict').value = userLocation.district;
            if (userLocation.street) document.getElementById('modalStreet').value = userLocation.street;
            if (userLocation.number) document.getElementById('modalNumber').value = userLocation.number;
            if (userLocation.complement) document.getElementById('modalComplement').value = userLocation.complement;
        }

        // Listener para auto-busca ao digitar bairro
        const districtInput = document.getElementById('modalDistrict');
        if (districtInput) {
            districtInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const val = districtInput.value.trim();
                    if (val.length >= 3) {
                        searchLocationFromFields(true); // true = silent search
                    }
                }, 800);
            });
        }
    }, 100);
};

window.closeLocationModal = () => {
    document.getElementById('locationModal').style.display = 'none';
    document.body.style.overflow = '';
};

function initLocationMap() {
    if (map) {
        map.invalidateSize();
        return;
    }

    const defaultLat = restaurant?.lat || -23.55052;
    const defaultLon = restaurant?.lon || -46.633308;
    // Proteção contra fallback legado (sem lat/lon)
    const startPos = (userLocation && typeof userLocation.lat !== "undefined")
        ? [userLocation.lat, userLocation.lon]
        : [defaultLat, defaultLon];

    try {
        map = L.map('locationMap').setView(startPos, 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        marker = L.marker(startPos, { draggable: true }).addTo(map);

        marker.on('dragend', function (e) {
            const pos = marker.getLatLng();
            reverseGeocodeStructured(pos.lat, pos.lng);
        });
    } catch (e) {
        console.error("Erro ao inicializar mapa:", e);
    }
}

async function reverseGeocodeStructured(lat, lon) {
    if (!geoapifyApiKey) return;
    try {
        const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${geoapifyApiKey}`;
        const res = await fetch(url).then(r => r.json());

        if (res.features && res.features.length > 0) {
            const props = res.features[0].properties;

            const district = props.suburb || props.district || '';
            const street = props.street || '';
            const number = props.housenumber || '';
            const city = props.city || document.getElementById('modalCity').value;
            const state = props.state_code || document.getElementById('modalState').value;

            // Atualiza os inputs do modal visualmente se o arrasto trouxe dados melhores
            if (district && !document.getElementById('modalDistrict').value) document.getElementById('modalDistrict').value = district;
            if (street) document.getElementById('modalStreet').value = street;
            if (number) document.getElementById('modalNumber').value = number;

            // Constrói o endereço final de exibição
            const fullAddress = `${street || 'Rua não identificada'}, ${number || 'S/N'}, ${district || 'Bairro Base'} - ${city} / ${state}`.replace(/,,/g, ',').trim();

            tempLocation = {
                lat,
                lon,
                address: fullAddress,
                district: district || document.getElementById('modalDistrict').value,
                street: street || document.getElementById('modalStreet').value,
                number: number || document.getElementById('modalNumber').value,
                city: city,
                state: state,
                complement: document.getElementById('modalComplement').value
            };

            // LIVE UPDATE: Update delivery fee in the modal visually while dragging
            if (restaurant && restaurant.acceptDelivery) {
                try {
                    const url = `${API_URL}/tenants/calcular-entrega?restauranteId=${restaurant.id}&latDestino=${lat}&lonDestino=${lon}`;
                    const res = await fetch(url).then(r => r.json());
                    if (res.price !== undefined) {
                        calculatedDeliveryFee = res.price;
                        updateCartTotalUI();
                    }
                } catch (e) { /* ignore live update error */ }
            }
        }
    } catch (e) {
        console.error('Erro no reverse geocoding:', e);
    }
}

window.searchLocationFromFields = async (silent = false) => {
    if (!geoapifyApiKey) {
        if (!silent) alert("Aviso: Chave do mapa indisponível.");
        return;
    }

    const state = document.getElementById('modalState').value;
    const city = document.getElementById('modalCity').value;
    const district = document.getElementById('modalDistrict').value.trim();
    const street = document.getElementById('modalStreet').value.trim();
    const number = document.getElementById('modalNumber').value.trim();

    if (!city || !district) {
        if (!silent) alert("Por favor, preencha pelo menos o Bairro para o mapa poder localizar e calcular o frete corretamente.");
        return;
    }

    const btn = document.querySelector('button[onclick="searchLocationFromFields()"]');
    if (btn) {
        btn.innerHTML = 'Buscando... ⏳';
        btn.disabled = true;
    }

    try {
        // ETAPA 1: Buscar o Bairro primeiro (âncora principal para o frete)
        const districtQuery = `${district}, ${city}, ${state}`;
        const districtUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(districtQuery)}&limit=1&type=neighborhood&apiKey=${geoapifyApiKey}`;
        let districtRes = await fetch(districtUrl).then(r => r.json());

        // Fallback amplo se não achar como "neighborhood" explícito
        if (!districtRes.features || districtRes.features.length === 0) {
            const fallbackUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(districtQuery)}&limit=1&apiKey=${geoapifyApiKey}`;
            districtRes = await fetch(fallbackUrl).then(r => r.json());
        }

        if (!districtRes.features || districtRes.features.length === 0) {
            if (!silent) alert("⚠️ Bairro não encontrado no mapa automaticamente.\n\nPor favor, arraste o pino azul pelo mapa até o seu local exato para garantirmos o cálculo correto do frete!");
            return;
        }

        const districtProps = districtRes.features[0].properties;
        let finalLat = districtProps.lat;
        let finalLon = districtProps.lon;
        let finalStreet = street; // Mantém o que usuário digitou
        let foundStreet = false;

        // ETAPA 2: Se usuário informou rua, procurar DENTRO do bounding box do bairro
        if (street && districtProps.bbox) {
            const bbox = districtProps.bbox;
            const bboxQuery = `&filter=rect:${bbox.lon1},${bbox.lat1},${bbox.lon2},${bbox.lat2}`;
            const streetQuery = `${number ? number + ' ' : ''}${street}, ${district}, ${city}, ${state}`;
            const streetUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(streetQuery)}${bboxQuery}&limit=1&apiKey=${geoapifyApiKey}`;

            try {
                const streetRes = await fetch(streetUrl).then(r => r.json());
                if (streetRes.features && streetRes.features.length > 0) {
                    finalLat = streetRes.features[0].properties.lat;
                    finalLon = streetRes.features[0].properties.lon;
                    if (streetRes.features[0].properties.street) {
                        finalStreet = streetRes.features[0].properties.street;
                    }
                    foundStreet = true;
                }
            } catch (e) { console.warn('Erro ao refinar rua no bairro', e); }
        }

        // Atualizar mapa
        if (map && marker) {
            const pos = [finalLat, finalLon];
            map.setView(pos, foundStreet ? 17 : 15);
            marker.setLatLng(pos);
        }

        const complement = document.getElementById('modalComplement').value;
        const fullAddress = `${finalStreet || 'Rua não informada'}, ${number || 'S/N'}, ${district} - ${city} / ${state}`;

        tempLocation = {
            lat: finalLat, lon: finalLon, address: fullAddress, district, street: finalStreet, number, city, state, complement
        };

        // Força atualização visual do frete no modal se possível
        if (restaurant && restaurant.acceptDelivery) {
            const url = `${API_URL}/tenants/calcular-entrega?restauranteId=${restaurant.id}&latDestino=${finalLat}&lonDestino=${finalLon}`;
            const feeRes = await fetch(url).then(r => r.json());
            if (feeRes.price !== undefined) {
                calculatedDeliveryFee = feeRes.price;
                updateCartTotalUI();
            }
        }

    } catch (e) {
        console.error('Erro ao buscar localização:', e);
        if (!silent) alert("Ocorreu um erro de rede ao tentar localizar o endereço.");
    } finally {
        if (btn) {
            btn.innerHTML = '🔍 Localizar Bairro / Rua no Mapa';
            btn.disabled = false;
        }
    }
};

window.selectFavorite = (type) => {
    if (favorites[type]) {
        userLocation = favorites[type];
        tempLocation = { ...favorites[type] }; // Sincroniza

        // Preenche campos se existirem na estrutura nova do favorito
        if (favorites[type].district) document.getElementById('modalDistrict').value = favorites[type].district;
        if (favorites[type].street) document.getElementById('modalStreet').value = favorites[type].street;
        if (favorites[type].number) document.getElementById('modalNumber').value = favorites[type].number;

        if (map && marker) {
            const pos = [userLocation.lat, userLocation.lon];
            map.setView(pos, 16);
            marker.setLatLng(pos);
        }
    } else {
        alert('Nenhum endereço salvo como ' + (type === 'home' ? 'Casa' : 'Trabalho') + ' ainda. Salva ao confirmar do pedido.');
    }
};

window.clearLocation = () => {
    // 1. Limpa os campos do Modal (exceto UF e Cidade Base, que vêm da loja idealmente)
    document.getElementById('modalDistrict').value = '';
    document.getElementById('modalStreet').value = '';
    document.getElementById('modalNumber').value = '';
    document.getElementById('modalComplement').value = '';

    // 2. Limpa variáveis de estado e armazenamento
    userLocation = null;
    tempLocation = null;
    localStorage.removeItem('userLocation');

    // 3. Reseta os labels no Frontend
    const headerLabel = document.getElementById('currentAddressLabel');
    if (headerLabel) headerLabel.textContent = 'Escolher localização...';

    const checkoutLabel = document.getElementById('checkoutAddressLabel');
    if (checkoutLabel) checkoutLabel.textContent = 'Ajustar no mapa...';

    // 4. Se tiver mapa, tenta voltar pro centro base da loja
    if (map && marker) {
        const defaultLat = restaurant?.lat || -23.55052;
        const defaultLon = restaurant?.lon || -46.633308;
        const pos = [defaultLat, defaultLon];
        map.setView(pos, 15);
        marker.setLatLng(pos);
    }

    // 5. Atualiza frete pra 0
    updateDeliveryFee();

    alert('Endereço limpo! Você pode digitar um novo bairro BEM devagar para o mapa buscar.');
};

window.confirmLocation = () => {
    // Sempre lê os campos atuais do modal para garantir que Número e Complemento estão frescos
    const state = document.getElementById('modalState').value;
    const city = document.getElementById('modalCity').value;
    const district = document.getElementById('modalDistrict').value;
    const street = document.getElementById('modalStreet').value;
    const number = document.getElementById('modalNumber').value;
    const complement = document.getElementById('modalComplement').value;

    if (!district) {
        alert('Por favor, informe pelo menos o seu bairro para continuarmos.');
        return;
    }

    if (!tempLocation) {
        // Se ainda não houve busca no mapa, gera um tempLocation base com coordenadas da loja
        const address = `${street || 'Rua não informada'}, ${number || 'S/N'}, ${district} - ${city} / ${state}`;
        tempLocation = {
            lat: restaurant?.lat || -23.5505,
            lon: restaurant?.lon || -46.6333,
            address, district, street, number, city, state, complement
        };
    } else {
        // Se já existe tempLocation (pelo mapa ou busca), apenas atualiza os campos de texto/número
        tempLocation.number = number;
        tempLocation.complement = complement;
        tempLocation.district = district;
        tempLocation.street = street;
        tempLocation.address = `${street || 'Rua'}, ${number || 'S/N'}, ${district} - ${city} / ${state}`;
    }

    userLocation = tempLocation;
    localStorage.setItem('userLocation', JSON.stringify(userLocation));

    // Atualizar Labels no Header e Checkout
    const headerLabel = document.getElementById('currentAddressLabel');
    if (headerLabel) headerLabel.textContent = userLocation.address;

    const checkoutLabel = document.getElementById('checkoutAddressLabel');
    if (checkoutLabel) checkoutLabel.textContent = userLocation.address;

    // Como os campos individuais foram removidos do DOM para simplificar o UX,
    // não precisamos mais tentar preenchê-los aqui. O envio no checkout usa o objeto userLocation.

    // Atualizar Frete baseado nas coordenadas
    updateDeliveryFee();
    closeLocationModal();
};

async function updateDeliveryFee() {
    if (!userLocation || !restaurant) return;

    try {
        const url = `${API_URL}/tenants/calcular-entrega?restauranteId=${restaurant.id}&latDestino=${userLocation.lat}&lonDestino=${userLocation.lon}`;
        const res = await fetch(url).then(r => r.json());

        if (res.price !== undefined) {
            calculatedDeliveryFee = res.price;
            updateCartTotalUI();
        } else {
            console.warn('Erro no cálculo de frete:', res.error);
            calculatedDeliveryFee = restaurant.deliveryFee || 0;
            updateCartTotalUI();
        }
    } catch (e) {
        console.error('Erro ao chamar API de frete:', e);
        calculatedDeliveryFee = restaurant.deliveryFee || 0;
        updateCartTotalUI();
    }
}

window.applyCoupon = async () => {
    const code = document.getElementById('couponInput').value.trim();
    if (!code) return;

    const itemsPrice = cart.reduce((acc, item) => acc + (item.totalItemPrice * item.quantity), 0);
    const msg = document.getElementById('couponMessage');

    try {
        const res = await fetch(`${API_URL}/marketing/coupons/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, tenantId: restaurant.id, orderAmount: itemsPrice })
        });

        const data = await res.json();
        if (!res.ok) {
            msg.textContent = data.error;
            msg.style.color = '#ef4444';
            msg.style.display = 'block';
            appliedCoupon = null;
        } else {
            appliedCoupon = { code: code.toUpperCase(), ...data };
            msg.textContent = `Cupom aplicado! Desconto de ${data.type === 'percentage' ? data.value + '%' : 'R$ ' + data.value.toFixed(2)}`;
            msg.style.color = '#10b981';
            msg.style.display = 'block';
        }
        updateCartTotalUI();
    } catch (e) {
        msg.textContent = 'Erro ao validar cupom.';
        msg.style.display = 'block';
    }
};

function updateCartTotalUI() {
    const modalTotal = document.getElementById('modalTotal');
    const itemsPrice = cart.reduce((acc, item) => acc + (item.totalItemPrice * item.quantity), 0);
    const fulfillmentType = document.getElementById('fulfillmentType')?.value || 'dine_in';
    const fee = fulfillmentType === 'delivery' ? calculatedDeliveryFee : 0;

    let discount = 0;
    if (appliedCoupon) {
        if (appliedCoupon.type === 'percentage') {
            discount = itemsPrice * (appliedCoupon.value / 100);
        } else {
            discount = appliedCoupon.value;
        }
        discount = Math.min(discount, itemsPrice);
    }

    const finalTotal = itemsPrice + fee - discount;

    if (modalTotal) {
        let breakDown = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
        if (fee > 0 || discount > 0) {
            let details = `(Itens: R$ ${itemsPrice.toFixed(2).replace('.', ',')}`;
            if (fee > 0) details += ` + Entrega: R$ ${fee.toFixed(2).replace('.', ',')}`;
            if (discount > 0) details += ` - Desconto: R$ ${discount.toFixed(2).replace('.', ',')}`;
            details += `)`;
            breakDown += ` <small class="text-secondary" style="font-weight: 400; font-size: 0.8rem; display:block;">${details}</small>`;
        }
        modalTotal.innerHTML = breakDown;
    }
}

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

    const itemsPrice = cart.reduce((acc, item) => acc + (item.totalItemPrice * item.quantity), 0);
    const minVal = getMinOrderValue(fulfillmentType);
    if (itemsPrice < minVal) {
        alert(`O valor mínimo dos itens para ${translateFulfillment(fulfillmentType)} é ${minVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Adicione mais itens ao seu carrinho.`);
        return;
    }

    const fee = fulfillmentType === 'delivery' ? calculatedDeliveryFee : 0;
    const totalPrice = itemsPrice + fee;

    // Coletar campos de endereço se for delivery
    let addressData = {};
    if (fulfillmentType === 'delivery') {
        if (!userLocation || !userLocation.street) {
            alert('Por favor, defina um local de entrega clicando no botão editar no mapa.');
            return;
        }
        addressData = {
            addressState: userLocation.state || '',
            addressCity: userLocation.city || '',
            addressDistrict: userLocation.district || '',
            addressStreet: userLocation.street || '',
            addressNumber: userLocation.number || '',
            addressComplement: userLocation.complement || '',
            lat: userLocation.lat,
            lon: userLocation.lon
        };
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
            couponCode: appliedCoupon ? appliedCoupon.code : null,
            tableNumber: tableNumber, // Incluir numero da mesa
            ...addressData,
            totalAmount: totalPrice,
            items: cart.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                addons: (item.addons || []).map(a => ({ addonId: a.id })) // Backend deve suportar isso conforme novo schema
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

        let message = `*Nova Mensagem de: ${restaurant.name}*\n`;
        message += `*Pedido: #${orderNum}*\n`;
        message += `--------------------------\n`;
        message += `*Cliente:* ${name}\n`;
        message += `*Telefone:* ${phone}\n`;
        message += `*Tipo:* ${localTranslateFulfillment[fulfillmentType]}\n`;
        if (tableNumber) message += `*MESA:* ${tableNumber} 🪑\n`;
        message += `*Pagamento:* ${localTranslatePayment[paymentMethod]}\n\n`;

        if (fulfillmentType === 'delivery') {
            message += `*Endereço de Entrega:*\n`;
            message += `📍 Rua: ${addressData.addressStreet}, ${addressData.addressNumber || 'S/N'}\n`;
            message += `📍 Bairro: ${addressData.addressDistrict}\n`;
            if (addressData.addressComplement) message += `📍 Complemento: ${addressData.addressComplement}\n`;
            message += `\n`;
        }

        message += `*Itens:*\n`;
        cart.forEach(item => {
            message += `- ${item.quantity}x ${item.name} (${(item.totalItemPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})\n`;
            if (item.addons && item.addons.length > 0) {
                item.addons.forEach(a => {
                    message += `  └ + ${a.name} (${a.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})\n`;
                });
            }
        });

        message += `\n*Subtotal:* ${itemsPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
        if (fee > 0) message += `*Taxa de Entrega:* ${fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
        message += `*TOTAL: ${totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n`;
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
// CANCELLATION REQUEST
window.solicitarCancelamento = async (id) => {
    const reason = prompt('Por que deseja cancelar seu pedido?');
    if (reason === null) return; // Cancelled prompt

    try {
        const res = await fetch(`${API_URL}/orders/${id}/request-cancel`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason || 'Solicitado pelo cliente' })
        });

        const data = await res.json();
        if (res.ok) {
            alert('✅ Solicitação de cancelamento enviada. Aguarde confirmação da loja.');
            refreshMyOrders();
        } else {
            alert('❌ Erro: ' + data.error);
        }
    } catch (e) {
        alert('Erro ao processar solicitação.');
    }
};
