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

function renderMenu(data) {
    document.title = `${data.name} | Cardápio Digital`;
    document.getElementById('restName').textContent = data.name;

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
}

function scrollToCategory(id, el) {
    document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');

    const element = document.getElementById(id);
    const offset = 80;
    const bodyRect = document.body.getBoundingClientRect().top;
    const elementRect = element.getBoundingClientRect().top;
    const elementPosition = elementRect - bodyRect;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
    });
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
    const floating = document.getElementById('cartFloating');
    const count = document.getElementById('cartCount');
    const totalDisp = document.getElementById('cartTotal');

    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
    const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    if (totalItems > 0) {
        floating.style.display = 'block';
        count.textContent = totalItems;
        totalDisp.textContent = totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } else {
        floating.style.display = 'none';
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
}

async function checkout() {
    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const btn = document.getElementById('checkoutBtn');

    if (!name || !phone) {
        alert('Por favor, preencha seu nome e telefone.');
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Enviando pedido...';

        // 1. Persist in Database
        const orderData = {
            tenantId: restaurant.id,
            customerName: name,
            customerPhone: phone,
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
        let message = `*Novo Pedido: #${result.order.id}*\n`;
        message += `--------------------------\n`;
        message += `*Cliente:* ${name}\n`;
        message += `*Telefone:* ${phone}\n\n`;
        message += `*Itens:*\n`;

        cart.forEach(item => {
            message += `- ${item.quantity}x ${item.name} (${(item.price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})\n`;
        });

        const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        message += `\n*TOTAL: ${totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n`;
        message += `--------------------------\n`;
        message += `_Pedido realizado via SmartPedidos_`;

        // 3. Open WhatsApp
        const encodedMessage = encodeURIComponent(message);
        // Using a dummy phone for now or we could get from restaurant settings if added
        const waLink = `https://wa.me/5511999999999?text=${encodedMessage}`;

        window.open(waLink, '_blank');

        // 4. Clear Cart
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
