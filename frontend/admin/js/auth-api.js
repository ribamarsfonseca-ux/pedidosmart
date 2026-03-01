const API_URL = '/api';

// Utility to show messages on screen
const showAlert = (message, type = 'error') => {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    alertBox.className = `alert ${type}`;
    alertBox.textContent = message;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 5000);
};

// Handle Login Form Submit
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('loginBtn');

        try {
            btn.disabled = true;
            btn.textContent = 'Autenticando...';

            const response = await fetch(`${API_URL}/tenants/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao realizar login.');
            }

            // Save token and navigate
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('tenant_data', JSON.stringify(data.tenant));

            showAlert('Sucesso! Redirecionando...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);

        } catch (error) {
            showAlert(error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Entrar no Painel';
        }
    });
}

// Handle Register Form Submit
const registerForm = document.getElementById('registerForm');
if (registerForm) {

    // Format slug interactively
    const slugInput = document.getElementById('slug');
    if (slugInput) {
        slugInput.addEventListener('input', (e) => {
            e.target.value = e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        });
    }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tenantName = document.getElementById('tenantName').value;
        const logoUrl = document.getElementById('logoUrl').value;
        const slug = document.getElementById('slug').value;
        const adminEmail = document.getElementById('adminEmail').value;
        const adminPassword = document.getElementById('adminPassword').value;

        const btn = document.getElementById('registerBtn');

        try {
            btn.disabled = true;
            btn.textContent = 'Criando loja...';

            const response = await fetch(`${API_URL}/tenants/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tenantName, slug, adminEmail, adminPassword, logoUrl })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao criar conta.');
            }

            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('tenant_data', JSON.stringify(data.tenant));

            showAlert('Loja criada com sucesso! Carregando painel...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);

        } catch (error) {
            showAlert(error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Iniciar Teste Grátis';
        }
    });
}
