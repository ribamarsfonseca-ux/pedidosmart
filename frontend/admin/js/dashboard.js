const API_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Check
    const token = localStorage.getItem('auth_token');
    const tenantDataRaw = localStorage.getItem('tenant_data');

    if (!token || !tenantDataRaw) {
        window.location.href = 'index.html';
        return;
    }

    let tenantData = JSON.parse(tenantDataRaw);

    async function refreshTenantData() {
        try {
            const data = await apiFetch('/tenants/me');
            if (data && data.tenant) {
                tenantData = data.tenant;
                localStorage.setItem('tenant_data', JSON.stringify(tenantData));
                // Update header if already in DOM
                const nameDisplay = document.getElementById('tenantNameDisplay');
                if (nameDisplay) nameDisplay.innerHTML = `${renderLogo()} ${tenantData.name}`;
                checkActiveStatus(); // Verificar status após atualizar
            }
        } catch (e) {
            console.error('Erro ao atualizar dados do lojista:', e);
        }
    }

    async function checkActiveStatus() {
        if (tenantData && tenantData.active === false) {
            // Se inativo, buscar dados do dev para mostrar suporte
            let devData = {};
            try {
                const res = await fetch('/api/tenants/public-configs');
                devData = await res.json();
            } catch (e) { }

            const overlayId = 'blocked-admin-overlay';
            if (!document.getElementById(overlayId)) {
                const html = `
                    <div id="${overlayId}" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.95); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(10px);">
                        <div style="background:white; padding:40px; border-radius:24px; max-width:500px; width:100%; text-align:center; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
                            <div style="font-size:4rem; margin-bottom:20px;">⚠️</div>
                            <h2 style="color:#0f172a; margin-bottom:15px; font-size:1.75rem;">Sua loja está temporariamente bloqueada</h2>
                            <p style="color:#64748b; margin-bottom:30px; line-height:1.6;">O acesso ao painel administrativo foi suspenso. Isso geralmente ocorre por pendências de pagamento ou manutenção do sistema.</p>
                            
                            <div style="background:#f8fafc; padding:20px; border-radius:16px; margin-bottom:30px; text-align:left;">
                                <p style="font-weight:700; color:#0f172a; margin-bottom:12px; font-size:0.9rem;">Fale com o suporte para desbloquear:</p>
                                <a href="https://wa.me/${(devData.devPhone || '').replace(/\D/g, '')}?text=Olá, minha loja ${tenantData.name} está bloqueada." target="_blank" style="display:flex; align-items:center; gap:12px; background:#25d366; color:white; padding:12px; border-radius:12px; text-decoration:none; font-weight:600; margin-bottom:10px; justify-content:center;">
                                    <span>💬 WhatsApp do Suporte</span>
                                </a>
                                <a href="mailto:${devData.devEmail || ''}" style="display:flex; align-items:center; gap:12px; background:#ef4444; color:white; padding:12px; border-radius:12px; text-decoration:none; font-weight:600; justify-content:center;">
                                    <span>📧 Enviar E-mail</span>
                                </a>
                            </div>
                            
                            <button onclick="localStorage.removeItem('auth_token'); location.reload();" style="background:none; border:none; color:#64748b; font-weight:600; cursor:pointer; text-decoration:underline;">Sair da conta</button>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', html);
            }
        }
    }

    // 2. Setup Base UI Elements
    const renderLogo = () => {
        if (tenantData.logoUrl) {
            return `<img src="${tenantData.logoUrl}" alt="${tenantData.name}" style="height: 40px; margin-right: 10px; border-radius: 4px;">`;
        }
        return ``;
    };

    document.getElementById('tenantNameDisplay').innerHTML = `${renderLogo()} ${tenantData.name}`;
    const publicMenuLink = document.getElementById('publicMenuLink');
    // Consider dynamic domain instead of local path later
    publicMenuLink.href = `../menu/index.html#${tenantData.slug}`;

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('tenant_data');
        window.location.href = 'index.html';
    });

    // 3. Simple SPA Navigation logic
    refreshTenantData(); // Fetch fresh data in background
    checkActiveStatus(); // Primeira verificação com dados do localStorage

    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const contentArea = document.getElementById('app-content');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');

    const views = {
        'home': {
            title: 'Visão Geral',
            subtitle: 'Resumo das atividades do seu restaurante',
            render: () => renderHomeView()
        },
        'orders': {
            title: 'Pedidos Recentes',
            subtitle: 'Gerencie e altere o status dos pedidos em andamento',
            render: () => renderOrdersView()
        },
        'catalog': {
            title: 'Cardápio & Produtos',
            subtitle: 'Adicione categorias, acompanhamentos e pratos',
            render: () => renderCatalogView()
        },
        'settings': {
            title: 'Configurações',
            subtitle: 'Ajuste os dados da sua loja e informações',
            render: () => renderSettingsView()
        }
    };

    function loadView(pageId) {
        // Update Active Nav State
        navLinks.forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`.sidebar-nav a[data-page="${pageId}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Update Headers
        const viewConfig = views[pageId];
        pageTitle.textContent = viewConfig.title;
        pageSubtitle.textContent = viewConfig.subtitle;

        // Clear and Render
        contentArea.innerHTML = '<div class="loading-state"><p>Carregando...</p></div>';

        // Timeout to simulate transition
        setTimeout(() => {
            contentArea.innerHTML = viewConfig.render();
            // Call post render logic if it exists on window
            if (window[`init${pageId.charAt(0).toUpperCase() + pageId.slice(1)}View`]) {
                window[`init${pageId.charAt(0).toUpperCase() + pageId.slice(1)}View`]();
            }
        }, 100);
    }

    // Bind clicks to navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = e.target.closest('a').dataset.page;
            loadView(pageId);
        });
    });

    // 4. API Helpers
    async function apiFetch(endpoint, options = {}) {
        const token = localStorage.getItem('auth_token');
        const defaultHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            window.location.href = 'index.html';
            return;
        }

        if (response.status === 204) return null;

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro na requisição');
        return data;
    }

    window.downloadBackup = (type) => {
        const token = localStorage.getItem('auth_token');
        window.open(`${API_URL}/orders/backup?type=${type}&token=${token}`, '_blank');
    };

    // 5. Shared UI Components
    function renderModal(title, content, actionBtnText, onAction) {
        const modalId = `modal-${Math.random().toString(36).substr(2, 9)}`;
        const modalHtml = `
            <div id="${modalId}" class="modal-overlay">
                <div class="modal-content glass-card">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="btn-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="document.getElementById('${modalId}').remove()">Cancelar</button>
                        <button class="btn btn-primary" id="${modalId}-action">${actionBtnText}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById(`${modalId}-action`).addEventListener('click', async () => {
            const btn = document.getElementById(`${modalId}-action`);
            btn.disabled = true;
            btn.textContent = 'Aguarde...';
            try {
                await onAction();
                document.getElementById(`${modalId}`).remove();
            } catch (error) {
                alert(error.message);
                btn.disabled = false;
                btn.textContent = actionBtnText;
            }
        });
    }

    // 6. View Renderers
    function renderHomeView() {
        return `
        <div class="grid-cols-3">
            <div class="glass-card">
                <p class="text-secondary">Vendas (Hoje)</p>
                <h2 id="todaySales" style="font-size: 2rem; margin-top: 5px;">R$ 0,00</h2>
            </div>
            <div class="glass-card">
                <p class="text-secondary">Pedidos Abertos</p>
                <h2 id="openOrders" style="font-size: 2rem; margin-top: 5px; color: var(--primary);">0</h2>
            </div>
            <div class="glass-card">
                <p class="text-secondary">Produtos Ativos</p>
                <h2 id="activeProducts" style="font-size: 2rem; margin-top: 5px;">0</h2>
            </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="window.downloadBackup('daily')" class="btn btn-outline" style="font-size: 0.8rem;">📥 Backup de Hoje (CSV)</button>
            <button onclick="window.downloadBackup('full')" class="btn btn-outline" style="font-size: 0.8rem;">📥 Backup Completo (CSV)</button>
        </div>
        <div class="glass-card">
            <h3>Bem-vindo ao SmartPede</h3>
            <p class="text-secondary mt-4">Sua loja <b>${tenantData.name}</b> está configurada.</p>
            <p class="text-secondary">O link para seus clientes acessarem seu cardápio é:</p>
            <div class="mt-4" style="background: #F9FAFB; padding: 1rem; border-radius: 8px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <code>http://${window.location.host}/menu/#${tenantData.slug}</code>
                <input type="hidden" id="linkToCopy" value="http://${window.location.host}/menu/#${tenantData.slug}">
                <button class="btn btn-outline" style="width: auto; padding: 0.5rem 1rem;" onclick="copyMenuLink()">Copiar</button>
            </div>
        </div>
        
        <div class="glass-card" style="margin-top: 1rem;">
            <h3>Histórico de Vendas Diárias</h3>
            <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;" id="salesHistoryList">
                <p class="text-secondary" style="font-size: 0.9rem;">Processando vendas passadas...</p>
            </div>
        </div>
        `;
    }

    window.copyMenuLink = () => {
        const copyText = document.getElementById("linkToCopy");
        copyText.type = 'text'; // temporarily un-hide for mobile copy
        copyText.select();
        copyText.setSelectionRange(0, 99999);
        try {
            document.execCommand('copy');
            alert("Link copiado: " + copyText.value);
        } catch (e) {
            alert("Erro ao copiar, tente selecionar o texto e copiar manualmente.");
        }
        copyText.type = 'hidden';
    };

    window.initHomeView = async () => {
        try {
            const products = await apiFetch('/products');
            const orders = await apiFetch('/orders');

            document.getElementById('activeProducts').textContent = products.filter(p => p.active).length;
            document.getElementById('openOrders').textContent = orders.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready').length;

            const finishedOrders = orders.filter(o => o.status === 'finished');

            // Data de hoje ajustada para fuso de Brasília (UTC-3)
            const now = new Date();
            const brazilNow = new Date(now.getTime() - (3 * 60 * 60 * 1000));
            const todayISO = brazilNow.toISOString().split('T')[0];

            // Total Vendas Hoje
            const todaySales = finishedOrders.concat(orders.filter(o => o.status === 'completed')).filter(o => {
                const orderDate = new Date(new Date(o.createdAt).getTime() - (3 * 60 * 60 * 1000)).toISOString().split('T')[0];
                return orderDate === todayISO;
            });
            const totalSales = todaySales.reduce((acc, curr) => acc + curr.totalAmount, 0);
            document.getElementById('todaySales').textContent = totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            // Histórico de Vendas Diárias
            const salesByDate = {};
            [...finishedOrders, ...orders.filter(o => o.status === 'completed')].forEach(order => {
                const dateStr = new Date(order.createdAt).toLocaleDateString('pt-BR');
                if (!salesByDate[dateStr]) salesByDate[dateStr] = { count: 0, total: 0 };
                salesByDate[dateStr].count += 1;
                salesByDate[dateStr].total += order.totalAmount;
            });

            const historyContainer = document.getElementById('salesHistoryList');
            if (Object.keys(salesByDate).length === 0) {
                historyContainer.innerHTML = '<p class="text-secondary" style="font-size: 0.9rem;">Nenhuma venda finalizada ainda.</p>';
            } else {
                const dates = Object.keys(salesByDate).sort((a, b) => {
                    const [d1, m1, y1] = a.split('/');
                    const [d2, m2, y2] = b.split('/');
                    return new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
                });

                historyContainer.innerHTML = dates.map(date => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px dashed #eee;">
                        <span><strong>${date}</strong> <span class="text-secondary" style="font-size: 0.8rem; margin-left: 10px;">(${salesByDate[date].count} pedidos)</span></span>
                        <span style="color: var(--primary); font-weight: bold;">${salesByDate[date].total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                `).join('');
            }

        } catch (error) {
            console.error('Home View Error:', error);
        }
    };

    function renderOrdersView() {
        return `
            <div class="glass-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h3>Gestão de Pedidos</h3>
                    <button class="btn btn-outline" style="width: auto;" onclick="initOrdersView()">Atualizar</button>
                </div>
                <div id="ordersList" class="orders-grid">
                    <p class="text-secondary">Carregando pedidos...</p>
                </div>
            </div>
        `;
    }

    window.initOrdersView = async () => {
        const list = document.getElementById('ordersList');
        try {
            const orders = await apiFetch('/orders');
            if (orders.length === 0) {
                list.innerHTML = '<p class="text-secondary">Nenhum pedido recebido ainda.</p>';
                return;
            }

            list.innerHTML = orders.map(order => `
                <div class="order-card glass-card" style="border: 1px solid ${getStatusColor(order.status)}44; border-left: 4px solid ${getStatusColor(order.status)}">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <div>
                            <strong>#${order.orderNumber || order.id} - ${order.customerName}</strong>
                            <p class="text-secondary">${new Date(order.createdAt).toLocaleString()}</p>
                        </div>
                        <span class="status-badge" style="background: ${getStatusColor(order.status)}">${translateStatus(order.status)}</span>
                    </div>
                    <div class="order-items" style="margin-bottom: 1rem; font-size: 0.9rem;">
                        <p><strong>Tipo:</strong> ${translateFulfillment(order.fulfillmentType)} | <strong>Pagamento:</strong> ${translatePayment(order.paymentMethod)}</p>
                        ${order.fulfillmentType === 'delivery' ? `
                            <p style="background: #f3f4f6; padding: 5px; border-radius: 4px; margin: 5px 0;">
                                📍 ${order.addressStreet}, ${order.addressNumber}${order.addressDistrict ? ` - ${order.addressDistrict}` : ''}
                                ${order.addressComplement ? `<br><small>(${order.addressComplement})</small>` : ''}
                            </p>
                        ` : ''}
                        <div style="border-top: 1px solid #eee; margin-top: 5px; padding-top: 5px;">
                            ${order.items.map(item => `
                                <div style="display: flex; justify-content: space-between;">
                                    <span>${item.quantity}x ${item.product.name}</span>
                                    <span>${(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1rem;">
                        <strong>Total: ${order.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                        <div style="display: flex; gap: 0.5rem;">
                            ${renderStatusActions(order)}
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            list.innerHTML = `<p class="error">Erro ao carregar pedidos: ${error.message}</p>`;
        }
    };

    function getStatusColor(status) {
        const colors = {
            'pending': '#F59E0B',
            'accepted': '#3B82F6',
            'preparing': '#8B5CF6',
            'ready': '#10B981',
            'finished': '#6B7280',
            'completed': '#6B7280',
            'cancelled': '#EF4444'
        };
        return colors[status] || '#6B7280';
    }

    function translateStatus(status) {
        const translations = {
            'pending': 'Pendente',
            'accepted': 'Aceito',
            'preparing': 'Em Preparo',
            'ready': 'Pronto',
            'finished': 'Finalizado',
            'completed': 'Finalizado',
            'cancelled': 'Cancelado'
        };
        return translations[status] || status;
    }

    function translateFulfillment(type) {
        const t = { 'delivery': 'Delivery', 'pickup': 'Retirada', 'dine_in': 'Consumo Local' };
        return t[type] || type;
    }

    function translatePayment(method) {
        const t = { 'pix': 'Pix', 'card': 'Cartão', 'money': 'Dinheiro' };
        return t[method] || method;
    }

    function renderStatusActions(order) {
        const actions = {
            'pending': `<button class="btn btn-outline btn-sm" onclick="updateStatus(${order.id}, 'accepted')">Aceitar</button>`,
            'accepted': `<button class="btn btn-outline btn-sm" onclick="updateStatus(${order.id}, 'preparing')">Iniciar Preparo</button>`,
            'preparing': `<button class="btn btn-outline btn-sm" onclick="updateStatus(${order.id}, 'ready')">Marcar Pronto</button>`,
            'ready': `
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-primary btn-sm" style="background: #25D366; border-color: #25D366;" onclick="sendReadyNotification(${order.id})">📲 Notificar</button>
                    <button class="btn btn-outline btn-sm" onclick="updateStatus(${order.id}, 'finished')">Finalizar</button>
                </div>
            `
        };
        return actions[order.status] || '';
    }

    window.sendReadyNotification = async (orderId) => {
        try {
            const orders = await apiFetch('/orders');
            const order = orders.find(o => o.id === orderId);
            if (!order) return;

            let msg = tenantData.readyMessage || "Olá {cliente}, seu pedido está pronto para {tipo}! 🚀";
            msg = msg.replace('{cliente}', order.customerName)
                .replace('{tipo}', translateFulfillment(order.fulfillmentType))
                .replace('{pedido}', order.orderNumber || order.id);

            const waLink = `https://wa.me/${order.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
            window.open(waLink, '_blank');
        } catch (e) {
            alert('Erro ao gerar notificação: ' + e.message);
        }
    };

    window.updateStatus = async (orderId, newStatus) => {
        try {
            await apiFetch(`/orders/${orderId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            initOrdersView();
        } catch (error) {
            alert('Erro ao atualizar status: ' + error.message);
        }
    };

    function renderCatalogView() {
        return `
            <div style="display: flex; gap: 1.5rem;">
                <!-- Categories Sidebar -->
                <div style="flex: 0 0 300px;">
                    <div class="glass-card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3>Categorias</h3>
                            <button class="btn btn-primary btn-sm" style="width: auto;" onclick="openAddCategoryModal()">+</button>
                        </div>
                        <div id="categoriesList" class="list-group">
                            <p class="text-secondary">Carregando...</p>
                        </div>
                    </div>
                </div>

                <!-- Products Area -->
                <div style="flex: 1;">
                    <div class="glass-card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 id="currentCategoryTitle">Todos os Produtos</h3>
                            <button class="btn btn-primary" id="addProductBtn" style="width: auto;">+ Novo Produto</button>
                        </div>
                        <div id="productsList" class="products-table">
                            <p class="text-secondary">Selecione uma categoria ou carregue todos.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    window.initCatalogView = async () => {
        await loadCategories();
        await loadProducts();

        document.getElementById('addProductBtn').onclick = () => openAddProductModal();
    };

    async function loadCategories() {
        const list = document.getElementById('categoriesList');
        try {
            const categories = await apiFetch('/categories');
            window.categories = categories; // Cache globally for modals
            list.innerHTML = `
                <div class="category-item active" onclick="filterByCategory(null, this)">Todos os Produtos</div>
                ${categories.map(c => `
                    <div class="category-item" onclick="filterByCategory(${c.id}, this)">
                        ${c.name}
                        <button class="btn-text" onclick="event.stopPropagation(); deleteCategory(${c.id})">&times;</button>
                    </div>
                `).join('')}
            `;
        } catch (error) {
            list.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }

    async function loadProducts(categoryId = null) {
        const list = document.getElementById('productsList');
        try {
            const endpoint = categoryId ? `/products?categoryId=${categoryId}` : '/products';
            const products = await apiFetch(endpoint);

            // Front-end filter if API doesn't support query param yet (it will for now display all if endpoint not strictly filtered)
            const filtered = categoryId ? products.filter(p => p.categoryId === categoryId) : products;

            if (filtered.length === 0) {
                list.innerHTML = '<p class="text-secondary">Nenhum produto encontrado.</p>';
                return;
            }

            list.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Categoria</th>
                            <th>Preço</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                         ${filtered.map(p => `
                            <tr>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        ${p.imageUrl ? `<img src="${p.imageUrl}" style="width: 32px; height: 32px; border-radius: 4px; object-fit: cover;">` : '<div style="width: 32px; height: 32px; border-radius: 4px; background: #eee;"></div>'}
                                        <span>${p.name}</span>
                                    </div>
                                </td>
                                <td>${p.category.name}</td>
                                <td>${p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td>
                                    <label class="switch" style="position: relative; display: inline-block; width: 40px; height: 20px;">
                                        <input type="checkbox" ${p.active ? 'checked' : ''} onchange="toggleProductActive(${p.id}, this.checked)" style="opacity: 0; width: 0; height: 0;">
                                        <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${p.active ? 'var(--primary)' : '#ccc'}; transition: .4s; border-radius: 20px;">
                                            <span style="position: absolute; content: ''; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; transform: ${p.active ? 'translateX(20px)' : 'translateX(0)'};"></span>
                                        </span>
                                    </label>
                                    <span style="font-size: 0.75rem; margin-left: 5px; color: ${p.active ? 'var(--primary)' : '#666'};">${p.active ? 'Ativo' : 'Inativo'}</span>
                                </td>
                                <td>
                                    <button class="btn-text" onclick="deleteProduct(${p.id})">Remover</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            list.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }

    window.toggleProductActive = async (productId, active) => {
        try {
            await apiFetch(`/products/${productId}`, {
                method: 'PUT',
                body: JSON.stringify({ active })
            });
            // Update local state without full reload
            loadProducts();
        } catch (error) {
            alert('Erro ao mudar status: ' + error.message);
            loadProducts(); // Sync back
        }
    };

    window.filterByCategory = (id, el) => {
        document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
        document.getElementById('currentCategoryTitle').textContent = id ? el.textContent.trim() : 'Todos os Produtos';
        loadProducts(id);
    };

    window.openAddCategoryModal = () => {
        renderModal('Nova Categoria', `
            <div class="form-group">
                <label>Nome da Categoria</label>
                <input type="text" id="newCatName" placeholder="Ex: Bebidas, Pizzas...">
            </div>
            <div class="form-group">
                <label>Ordem de Exibição</label>
                <input type="number" id="newCatOrder" value="0">
            </div>
        `, 'Criar Categoria', async () => {
            const name = document.getElementById('newCatName').value;
            const order = parseInt(document.getElementById('newCatOrder').value);
            await apiFetch('/categories', {
                method: 'POST',
                body: JSON.stringify({ name, order })
            });
            loadCategories();
        });
    };

    window.deleteCategory = async (id) => {
        if (!confirm('Deseja realmente excluir esta categoria e todos os produtos vinculados?')) return;
        try {
            await apiFetch(`/categories/${id}`, { method: 'DELETE' });
            loadCategories();
            loadProducts();
        } catch (error) {
            alert(error.message);
        }
    };

    window.openAddProductModal = () => {
        if (!window.categories || window.categories.length === 0) {
            alert('Crie uma categoria antes de adicionar produtos.');
            return;
        }

        renderModal('Novo Produto', `
            <div class="form-group">
                <label>Nome do Produto</label>
                <input type="text" id="pName" required>
            </div>
            <div class="form-group">
                <label>Descrição</label>
                <textarea id="pDesc" style="width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem;"></textarea>
            </div>
            <div class="grid-cols-2">
                <div class="form-group">
                    <label>Preço</label>
                    <input type="number" id="pPrice" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Categoria</label>
                    <select id="pCat" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
                        ${window.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Link da Imagem do Produto (Opcional)</label>
                <input type="text" id="pImg" placeholder="https://...">
            </div>
        `, 'Salvar Produto', async () => {
            const payload = {
                name: document.getElementById('pName').value,
                description: document.getElementById('pDesc').value,
                price: parseFloat(document.getElementById('pPrice').value),
                categoryId: parseInt(document.getElementById('pCat').value),
                imageUrl: document.getElementById('pImg').value
            };
            await apiFetch('/products', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            loadProducts();
        });
    };

    window.deleteProduct = async (id) => {
        if (!confirm('Excluir este produto?')) return;
        try {
            await apiFetch(`/products/${id}`, { method: 'DELETE' });
            loadProducts();
        } catch (error) {
            alert(error.message);
        }
    };

    function renderSettingsView() {
        return `
            <div class="glass-card">
                <h3>Dados do Restaurante</h3>
                <div class="form-group mt-4">
                    <label>Nome do Estabelecimento</label>
                    <input type="text" id="set-name" value="${tenantData.name}" disabled>
                </div>
                <div class="form-group">
                    <label>Logotipo (Link da Imagem)</label>
                    <input type="text" id="set-logo" value="${tenantData.logoUrl || ''}" placeholder="https://exemplo.com/logo.png">
                </div>
                <div class="form-group">
                    <label>Sobre a Empresa / Descrição</label>
                    <textarea id="set-description" style="width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 0.8rem; height: 80px;" placeholder="Conte um pouco sobre sua empresa para seus clientes...">${tenantData.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Pedido Mínimo e Taxas (R$)</label>
                    <div class="grid-cols-4" style="gap: 10px;">
                        <div>
                            <small>Consumo Local</small>
                            <input type="number" id="min-dinein" step="0.01" value="${tenantData.minOrderDineIn || 0}">
                        </div>
                        <div>
                            <small>Retirada</small>
                            <input type="number" id="min-pickup" step="0.01" value="${tenantData.minOrderPickup || 0}">
                        </div>
                        <div>
                            <small>Min. Delivery</small>
                            <input type="number" id="min-delivery" step="0.01" value="${tenantData.minOrderDelivery || 0}">
                        </div>
                        <div>
                            <small>Taxa de Entrega</small>
                            <input type="number" id="delivery-fee" step="0.01" value="${tenantData.deliveryFee || 0}">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Cor Principal do Cardápio</label>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px;">
                        ${['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#6b7280', '#111827'].map(color => `
                            <div onclick="selectThemeColor('${color}')" id="color-${color}" style="width: 35px; height: 35px; border-radius: 50%; background: ${color}; cursor: pointer; border: 3px solid ${tenantData.primaryColor === color ? '#fff' : 'transparent'}; box-shadow: 0 0 5px rgba(0,0,0,0.2);"></div>
                        `).join('')}
                    </div>
                    <input type="hidden" id="set-color" value="${tenantData.primaryColor || '#3b82f6'}">
                    <p style="font-size: 0.75rem; color: #666; margin-top: 5px;">Escolha uma cor para personalizar o visual do seu cardápio online.</p>
                </div>
                <div class="form-group">
                    <label>WhatsApp de Contato (Ex: 5511999999999)</label>
                    <input type="text" id="set-whatsapp" value="${tenantData.whatsapp || ''}" placeholder="55 + DDD + Número">
                </div>
                <div class="form-group">
                    <label>Endereço</label>
                    <input type="text" id="set-address" value="${tenantData.address || ''}" placeholder="Rua exemplo, 123">
                </div>
                <div class="form-group">
                    <label>Link Google Maps</label>
                    <input type="url" id="set-maps" value="${tenantData.googleMapsUrl || ''}" placeholder="https://goo.gl/maps/...">
                </div>
                <div class="form-group">
                    <label>Formas de Pagamento (Separe por vírgula)</label>
                    <input type="text" id="set-payments" value="${tenantData.paymentMethods || ''}" placeholder="Pix, Dinheiro, Cartão">
                </div>
                <div class="form-group">
                    <label>Redes Sociais e Contato</label>
                    <div class="grid-cols-3" style="gap: 10px;">
                        <div>
                            <small>Instagram (URL)</small>
                            <input type="url" id="set-instagram" value="${tenantData.instagramUrl || ''}" placeholder="https://instagram.com/sualoja">
                        </div>
                        <div>
                            <small>Facebook (URL)</small>
                            <input type="url" id="set-facebook" value="${tenantData.facebookUrl || ''}" placeholder="https://facebook.com/sualoja">
                        </div>
                        <div>
                            <small>E-mail de Contato</small>
                            <input type="email" id="set-email" value="${tenantData.contactEmail || ''}" placeholder="contato@sualoja.com">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Template de Mensagem "Pedido Pronto"</label>
                    <textarea id="set-ready-msg" style="width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 0.8rem; height: 80px;" placeholder="Ex: Olá {cliente}, seu pedido está pronto para {tipo}! 🚀">${tenantData.readyMessage || "Olá {cliente}, seu pedido está pronto para {tipo}! 🚀"}</textarea>
                    <p style="font-size: 0.75rem; color: #666; margin-top: 5px;">Variáveis disponíveis: {cliente}, {tipo}, {pedido}</p>
                </div>
                <div class="form-group">
                    <label>Tempos Estimados (Ex: 30-40 min / 1:30h)</label>
                    <div class="grid-cols-2" style="gap: 10px;">
                        <div>
                            <small>Entrega/Retirada (Pick-up)</small>
                            <input type="text" id="set-estimated-time-pickup" value="${tenantData.estimatedTimePickup || ''}" placeholder="Ex: 30-40 min / 1:00h">
                        </div>
                        <div>
                            <small>Delivery (Entrega em casa)</small>
                            <input type="text" id="set-estimated-time-delivery" value="${tenantData.estimatedTimeDelivery || ''}" placeholder="Ex: 40-50 min / 1:30h">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Avisos Rápidos / Promoções (Exclusivo para o Recibo do WhatsApp)</label>
                    <input type="text" id="set-extra-info" value="${tenantData.extraInfo || ''}" placeholder="Ex: Promoção de hoje: Compre 1 leve 2! | Entregas em 40 min ⏰">
                    <p style="font-size: 0.75rem; color: #888; margin-top: 4px;">Este campo aparecerá apenas no comprovante de pedido enviado ao seu WhatsApp.</p>
                </div>
                <div class="form-group">
                    <label>Horários de Funcionamento (Configuração por Turnos)</label>
                    <div id="hours-table-container" style="background: #f9fafb; padding: 1rem; border-radius: 8px; border: 1px solid var(--border);">
                        ${renderOpeningHoursTable(tenantData.openingHours)}
                    </div>
                </div>
                <div class="form-group">
                    <label>Slug (Link amigável)</label>
                    <input type="text" value="${tenantData.slug}" disabled>
                </div>
                <div class="form-group">
                    <label>Tipo de Plano</label>
                    <p><strong>${tenantData.planType.toUpperCase()}</strong></p>
                </div>
                <div class="form-group">
                    <label>🔑 Senha do Frente de Caixa (PDV)</label>
                    <input type="password" id="set-pdv-password" value="${tenantData.pdvPassword || ''}" placeholder="Senha para acesso ao PDV">
                    <p style="font-size: 0.75rem; color: #666; margin-top: 5px;">Use esta senha para entrar no sistema de Frente de Caixa (PDV).</p>
                </div>
                <button class="btn btn-primary mt-4" onclick="saveSettings()">Salvar Alterações</button>
            </div>

            <div class="glass-card mt-8">
                <h3 style="margin-top:0;">🔑 Alterar Senha de Acesso</h3>
                <div class="form-group">
                    <label>Senha Atual</label>
                    <input type="password" id="pwd-current" placeholder="Digite sua senha atual">
                </div>
                <div class="form-group">
                    <label>Nova Senha</label>
                    <input type="password" id="pwd-new" placeholder="Mínimo 6 caracteres">
                </div>
                <div class="form-group">
                    <label>Confirmar Nova Senha</label>
                    <input type="password" id="pwd-confirm" placeholder="Repita a nova senha">
                </div>
                <button class="btn btn-primary" onclick="changePassword()">Alterar Senha</button>
            </div>
         `;
    }

    window.saveSettings = async () => {
        const logoUrl = document.getElementById('set-logo').value;
        const description = document.getElementById('set-description').value;
        const minOrderDineIn = parseFloat(document.getElementById('min-dinein').value) || 0;
        const minOrderPickup = parseFloat(document.getElementById('min-pickup').value) || 0;
        const minOrderDelivery = parseFloat(document.getElementById('min-delivery').value) || 0;
        const deliveryFee = parseFloat(document.getElementById('delivery-fee').value) || 0;
        const primaryColor = document.getElementById('set-color').value;
        const whatsapp = document.getElementById('set-whatsapp').value;
        const address = document.getElementById('set-address').value;
        const googleMapsUrl = document.getElementById('set-maps').value;
        const paymentMethods = document.getElementById('set-payments').value;
        const instagramUrl = document.getElementById('set-instagram').value;
        const facebookUrl = document.getElementById('set-facebook').value;
        const contactEmail = document.getElementById('set-email').value;
        const estimatedTimePickup = document.getElementById('set-estimated-time-pickup').value;
        const pdvPassword = document.getElementById('set-pdv-password').value.trim();

        // Coletar horários (v5: 2 turnos)
        const hours = {};
        const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        days.forEach(day => {
            const s1 = document.getElementById(`s1-${day}`).value;
            const e1 = document.getElementById(`e1-${day}`).value;
            const s2 = document.getElementById(`s2-${day}`).value;
            const e2 = document.getElementById(`e2-${day}`).value;

            hours[day] = {
                shift1: (s1 && e1) ? { start: s1, end: e1 } : null,
                shift2: (s2 && e2) ? { start: s2, end: e2 } : null
            };
        });
        const openingHours = JSON.stringify(hours);

        try {
            const response = await apiFetch(`/tenants/update`, {
                method: 'PUT',
                body: JSON.stringify({
                    logoUrl,
                    primaryColor,
                    whatsapp,
                    address,
                    googleMapsUrl,
                    paymentMethods,
                    openingHours,
                    description,
                    minOrderDineIn,
                    minOrderPickup,
                    minOrderDelivery,
                    deliveryFee,
                    readyMessage: document.getElementById('set-ready-msg').value,
                    instagramUrl,
                    facebookUrl,
                    contactEmail,
                    extraInfo: document.getElementById('set-extra-info').value,
                    estimatedTimeDelivery,
                    estimatedTimePickup,
                    pdvPassword: document.getElementById('set-pdv-password').value.trim()
                })
            });

            if (response.error) throw new Error(response.error);

            // Atualiza os dados locais para refletir o que foi salvo
            tenantData.pdvPassword = document.getElementById('set-pdv-password').value.trim();
            localStorage.setItem('tenant_data', JSON.stringify(tenantData));

            tenantData.logoUrl = logoUrl;
            tenantData.primaryColor = primaryColor;
            tenantData.whatsapp = whatsapp;
            tenantData.address = address;
            tenantData.googleMapsUrl = googleMapsUrl;
            tenantData.paymentMethods = paymentMethods;
            tenantData.openingHours = openingHours;
            tenantData.description = description;
            tenantData.minOrderDineIn = minOrderDineIn;
            tenantData.minOrderPickup = minOrderPickup;
            tenantData.minOrderDelivery = minOrderDelivery;
            tenantData.deliveryFee = deliveryFee;
            tenantData.readyMessage = document.getElementById('set-ready-msg').value;
            tenantData.instagramUrl = instagramUrl;
            tenantData.facebookUrl = facebookUrl;
            tenantData.contactEmail = contactEmail;
            tenantData.extraInfo = document.getElementById('set-extra-info').value;
            tenantData.estimatedTimeDelivery = estimatedTimeDelivery;
            tenantData.estimatedTimePickup = estimatedTimePickup;
            tenantData.pdvPassword = document.getElementById('set-pdv-password').value; // Novo campo

            localStorage.setItem('tenant_data', JSON.stringify(tenantData));
            alert('Configurações salvas! Recarregando...');
            window.location.reload();
        } catch (error) {
            alert('Erro ao salvar: ' + error.message);
        }
    };

    window.selectThemeColor = (color) => {
        document.getElementById('set-color').value = color;
        // Visual feedback
        document.querySelectorAll('[id^="color-"]').forEach(el => {
            el.style.border = '3px solid transparent';
        });
        document.getElementById(`color-${color}`).style.border = '3px solid #fff';
    };

    function renderOpeningHoursTable(currentHoursJson) {
        let hours = {};
        try {
            if (currentHoursJson) hours = JSON.parse(currentHoursJson);
        } catch (e) { }

        const dayLabels = {
            'mon': 'Seg', 'tue': 'Ter', 'wed': 'Qua',
            'thu': 'Qui', 'fri': 'Sex', 'sat': 'Sáb', 'sun': 'Dom'
        };

        return `
            <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse;">
                <thead>
                    <tr style="text-align: left; border-bottom: 2px solid #eee;">
                        <th style="padding: 8px 0;">Dia</th>
                        <th>Turno 1 (Início - Fim)</th>
                        <th>Turno 2 (Início - Fim)</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(dayLabels).map(day => {
            const h = hours[day] || {};
            const s1 = h.shift1 || (h.start ? { start: h.start, end: h.end } : { start: '', end: '' });
            const s2 = h.shift2 || { start: '', end: '' };

            const hasShift1 = s1.start && s1.end;
            const hasShift2 = s2.start && s2.end;

            return `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px 0; font-weight: 600;">${dayLabels[day]}</td>
                            <td>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <input type="checkbox" id="chk1-${day}" ${hasShift1 ? 'checked' : ''} onchange="window.toggleTimeInputs('${day}', 1)">
                                    <input type="time" id="s1-${day}" value="${s1.start || ''}" ${!hasShift1 ? 'disabled' : ''} style="width: 85px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; opacity: ${hasShift1 ? 1 : 0.5};">
                                    <span>-</span>
                                    <input type="time" id="e1-${day}" value="${s1.end || ''}" ${!hasShift1 ? 'disabled' : ''} style="width: 85px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; opacity: ${hasShift1 ? 1 : 0.5};">
                                </div>
                            </td>
                            <td>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <input type="checkbox" id="chk2-${day}" ${hasShift2 ? 'checked' : ''} onchange="window.toggleTimeInputs('${day}', 2)">
                                    <input type="time" id="s2-${day}" value="${s2.start || ''}" ${!hasShift2 ? 'disabled' : ''} style="width: 85px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; opacity: ${hasShift2 ? 1 : 0.5};">
                                    <span>-</span>
                                    <input type="time" id="e2-${day}" value="${s2.end || ''}" ${!hasShift2 ? 'disabled' : ''} style="width: 85px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; opacity: ${hasShift2 ? 1 : 0.5};">
                                </div>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
    }

    // toggleTimeInputs precisa estar no window para funcionar nos onchange dentro do innerHTML
    window.toggleTimeInputs = (day, shift) => {
        const chk = document.getElementById('chk' + shift + '-' + day);
        const s = document.getElementById('s' + shift + '-' + day);
        const e = document.getElementById('e' + shift + '-' + day);
        if (!chk || !s || !e) return;
        const active = chk.checked;
        s.disabled = !active;
        e.disabled = !active;
        s.style.opacity = active ? '1' : '0.5';
        e.style.opacity = active ? '1' : '0.5';
    };

    window.changePassword = async () => {
        const currentPassword = document.getElementById('pwd-current')?.value?.trim();
        const newPassword = document.getElementById('pwd-new')?.value?.trim();
        const confirmPassword = document.getElementById('pwd-confirm')?.value?.trim();

        if (!currentPassword || !newPassword || !confirmPassword) {
            alert('Por favor, preencha todos os campos de senha.');
            return;
        }
        if (newPassword !== confirmPassword) {
            alert('A nova senha e a confirmação não coincidem.');
            return;
        }
        if (newPassword.length < 6) {
            alert('A nova senha deve ter no mínimo 6 caracteres.');
            return;
        }

        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/tenants/change-password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                alert('✅ ' + data.message + '\n\nPor segurança, faça login novamente.');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('tenant_data');
                window.location.href = '/admin/index.html';
            } else {
                alert('❌ Erro: ' + data.error);
            }
        } catch (e) {
            alert('Erro ao alterar senha. Tente novamente.');
        }
    };

    // 7. Dynamic Badges
    async function updatePendingBadge() {
        try {
            const orders = await apiFetch('/orders');
            const pendingCount = orders.filter(o => o.status === 'pending').length;
            const badgeEl = document.querySelector('a[data-page="orders"] .pending-badge');

            if (pendingCount > 0) {
                if (badgeEl) {
                    badgeEl.textContent = pendingCount;
                } else {
                    const link = document.querySelector('a[data-page="orders"]');
                    link.insertAdjacentHTML('beforeend', `<span class="pending-badge" style="background:var(--primary); color:white; border-radius:10px; padding:2px 8px; font-size:0.75rem; margin-left:8px; font-weight:700;">${pendingCount}</span>`);
                }
            } else if (badgeEl) {
                badgeEl.remove();
            }
        } catch (e) { console.error('Badge update error:', e); }
    }

    // Update every 30 seconds
    setInterval(updatePendingBadge, 30000);
    updatePendingBadge(); // Initial call

    // Init Base View
    loadView('home');
});
