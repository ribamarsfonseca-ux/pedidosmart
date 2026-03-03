# Guia de Atualização - Hostinger VPS

Siga estes passos no terminal do seu VPS para aplicar todas as novas funcionalidades (PDV, Real-time, CRM, etc.):

### 1. Acessar a pasta do projeto
```bash
cd ~/pedidosmart
```

### 2. Puxar as novidades do GitHub
```bash
git pull origin master
```

### 3. Instalar novas dependências (Socket.io, etc.)
Entre na pasta do backend e instale os pacotes:
```bash
cd backend
npm install
```

### 4. Atualizar o Banco de Dados
Como adicionamos Tabelas, Entregadores e campos de Cancelamento, precisamos sincronizar o banco:
```bash
npx prisma db push
npx prisma generate
```

### 5. Reiniciar o Sistema
Reinicie o processo no PM2 para carregar o novo código com Socket.io:
```bash
pm2 restart all
# Ou especificamente:
# pm2 restart smartpedidos
```

---
**Nota:** Se você adicionou a `GEOAPIFY_API_KEY` no seu `.env` local, lembre-se de conferir se ela também está no `.env` do servidor para o cálculo de frete funcionar corretamente.
