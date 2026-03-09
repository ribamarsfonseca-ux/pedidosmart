const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Iniciando Upgrade Seguro do Banco de Dados ---');
    try {
        // SQL Nativo para adicionar colunas se não existirem (SQLite não suporta 'IF NOT EXISTS' em ADD COLUMN diretamente de forma limpa, então usamos try/catch)
        try {
            await prisma.$executeRawUnsafe('ALTER TABLE tenants ADD COLUMN geoapifyApiKey TEXT;');
            console.log('✅ Coluna geoapifyApiKey adicionada em tenants.');
        } catch (e) {
            console.log('ℹ️ Coluna geoapifyApiKey já existe ou não pôde ser adicionada.');
        }

        try {
            await prisma.$executeRawUnsafe('ALTER TABLE orders ADD COLUMN isVoided BOOLEAN DEFAULT 0;');
            console.log('✅ Coluna isVoided adicionada em orders.');
        } catch (e) {
            console.log('ℹ️ Coluna isVoided já existe ou não pôde ser adicionada.');
        }

        console.log('--- Sucesso! O banco de dados está atualizado ---');
    } catch (error) {
        console.error('❌ Erro durante o upgrade:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
