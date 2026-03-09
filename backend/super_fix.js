const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runStep(name, fn) {
    console.log(`\n--- Passo: ${name} ---`);
    try {
        await fn();
        console.log(`✅ ${name} concluído com sucesso.`);
    } catch (e) {
        console.error(`❌ Erro em ${name}:`, e.message);
    }
}

async function main() {
    console.log('🚀 Iniciando RECUPERAÇÃO MESTRE do SmartPede...');

    await runStep('Gerar Cliente Prisma', async () => {
        execSync('npx prisma generate', { stdio: 'inherit' });
    });

    await runStep('Verificar/Atualizar Estrutura do Banco', async () => {
        // Tenants
        try {
            await prisma.$executeRawUnsafe('ALTER TABLE tenants ADD COLUMN geoapifyApiKey TEXT;');
            console.log('   - Coluna geoapifyApiKey adicionada em tenants.');
        } catch (e) { }

        // Orders
        try {
            await prisma.$executeRawUnsafe('ALTER TABLE orders ADD COLUMN isVoided BOOLEAN DEFAULT 0;');
            console.log('   - Coluna isVoided adicionada em orders.');
        } catch (e) { }

        try {
            await prisma.$executeRawUnsafe('ALTER TABLE orders ADD COLUMN attendantName TEXT;');
            console.log('   - Coluna attendantName adicionada em orders.');
        } catch (e) { }
    });

    await runStep('Resetar Senha SuperAdmin', async () => {
        const newPass = 'admin123'; // Senha padrão de recuperação
        await prisma.config.upsert({
            where: { key: 'SUPER_ADMIN_PASSWORD' },
            update: { value: newPass },
            create: { key: 'SUPER_ADMIN_PASSWORD', value: newPass }
        });
        console.log(`   - Senha do SuperAdmin resetada para: ${newPass}`);
    });

    await runStep('Reiniciar PM2', async () => {
        try {
            execSync('pm2 restart all', { stdio: 'inherit' });
        } catch (e) {
            console.log('   - PM2 não encontrado ou erro ao reiniciar. Tente manualmente: pm2 restart all');
        }
    });

    console.log('\n✨ PROCESSO FINALIZADO!');
    console.log('--------------------------------------------------');
    console.log('1. Se o site ainda mostrar a versão antiga, limpe o cache do navegador (Ctrl+F5).');
    console.log('2. Tente logar no SuperAdmin com a senha: admin123');
    console.log('--------------------------------------------------');

    await prisma.$disconnect();
}

main();
