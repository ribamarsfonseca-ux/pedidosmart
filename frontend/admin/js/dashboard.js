const API_URL = 'http://187.77.226.40:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Check
    const token = localStorage.getItem('auth_token');
    const tenantDataRaw = localStorage.getItem('tenant_data');

    if (!token || !tenantDataRaw) {
        window.location.href = 'index.html';
        return;
    }

    const tenantData = JSON.parse(tenantDataRaw);

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
                <p class="text-secondary">Pratos Ativos</p>
                <h2 id="activeProducts" style="font-size: 2rem; margin-top: 5px;">0</h2>
            </div>
        </div>
        <div class="glass-card">
            <h3>Bem-vindo ao SmartPede</h3>
            <p class="text-secondary mt-4">Sua loja <b>${tenantData.name}</b> está configurada.</p>
            <p class="text-secondary">O link para seus clientes acessarem seu cardápio é:</p>
            <div class="mt-4" style="background: #F9FAFB; padding: 1rem; border-radius: 8px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <code>http://${window.location.host}/menu/#${tenantData.slug}</code>
                <button class="btn btn-outline" style="width: auto; padding: 0.5rem 1rem;" onclick="navigator.clipboard.writeText('http://' + window.location.host + '/menu/#' + '${tenantData.slug}'); alert('Link copiado!')">Copiar</button>
            </div>
        </div>
        `;
    }

    window.initHomeView = async () => {
        try {
            const products = await apiFetch('/products');
            const orders = await apiFetch('/orders');

            document.getElementById('activeProducts').textContent = products.filter(p => p.active).length;
            document.getElementById('openOrders').textContent = orders.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready').length;

            const totalSales = orders
                .filter(o => o.status === 'completed')
                .reduce((acc, curr) => acc + curr.totalAmount, 0);

            document.getElementById('todaySales').textContent = totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
                            <strong>#${order.id} - ${order.customerName}</strong>
                            <p class="text-secondary">${new Date(order.createdAt).toLocaleString()}</p>
                        </div>
                        <span class="status-badge" style="background: ${getStatusColor(order.status)}">${translateStatus(order.status)}</span>
                    </div>
                    <div class="order-items" style="margin-bottom: 1rem; font-size: 0.9rem;">
                        ${order.items.map(item => `
                            <div style="display: flex; justify-content: space-between;">
                                <span>${item.quantity}x ${item.product.name}</span>
                                <span>${(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        `).join('')}
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
            'completed': '#6B7280',
            'cancelled': '#EF4444'
        };
        return colors[status] || '#6B7280';
    }

    function translateStatus(status) {
        const translations = {
            'pending': 'Pendente',
            'accepted': 'Aceito',
            'preparing': 'Preparando',
            'ready': 'Pronto',
            'completed': 'Entregue',
            'cancelled': 'Cancelado'
        };
        return translations[status] || status;
    }

    function renderStatusActions(order) {
        const actions = {
            'pending': `<button class="btn btn-outline btn-sm" onclick="updateStatus(${order.id}, 'accepted')">Aceitar</button>`,
            'accepted': `<button class="btn btn-outline btn-sm" onclick="updateStatus(${order.id}, 'preparing')">Preparar</button>`,
            'preparing': `<button class="btn btn-outline btn-sm" onclick="updateStatus(${order.id}, 'ready')">Pronto</button>`,
            'ready': `<button class="btn btn-outline btn-sm" onclick="updateStatus(${order.id}, 'completed')">Finalizar</button>`
        };
        return actions[order.status] || '';
    }

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
                                <td><span class="status-pill ${p.active ? 'active' : 'inactive'}">${p.active ? 'Ativo' : 'Inativo'}</span></td>
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
                <label>URL da Imagem (Opcional)</label>
                <input type="url" id="pImg">
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
                    <label>Logotipo (URL da Imagem)</label>
                    <input type="url" id="set-logo" value="${tenantData.logoUrl || ''}" placeholder="https://exemplo.com/logo.png">
                </div>
                <div class="form-group">
                    <label>Slug (URL)</label>
                    <input type="text" value="${tenantData.slug}" disabled>
                </div>
                <div class="form-group">
                    <label>Tipo de Plano</label>
                    <p><strong>${tenantData.planType.toUpperCase()}</strong></p>
                </div>
                <button class="btn btn-primary mt-4" onclick="saveSettings()">Salvar Alterações</button>
            </div>
         `;
    }

    window.saveSettings = async () => {
        const logoUrl = document.getElementById('set-logo').value;
        try {
            // Note: We'll need a backend route for updating tenant settings if not already there, 
            // but for now we'll simulate or use the register endpoint if it supports PUT.
            // Actually, let's just update the local storage and inform the user they need to refresh 
            // or we could add a simple backend route.
            const response = await apiFetch(`/tenants/update`, {
                method: 'PUT',
                body: JSON.stringify({ logoUrl })
            });

            if (response.error) throw new Error(response.error);

            tenantData.logoUrl = logoUrl;
            localStorage.setItem('tenant_data', JSON.stringify(tenantData));
            alert('Configurações salvas! Recarregando...');
            window.location.reload();
        } catch (error) {
            alert('Erro ao salvar: ' + error.message);
        }
    };

    // Init Base View
    loadView('home');
});
