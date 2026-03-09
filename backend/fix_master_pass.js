const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const newPassword = process.argv[2];
    if (!newPassword) {
        console.error('Por favor, informe a nova senha: node fix_master_pass.js 123456');
        process.exit(1);
    }

    try {
        await prisma.config.upsert({
            where: { key: 'SUPER_ADMIN_PASSWORD' },
            update: { value: newPassword },
            create: { key: 'SUPER_ADMIN_PASSWORD', value: newPassword }
        });
        console.log('✅ Senha mestra do SuperAdmin atualizada com sucesso!');
    } catch (e) {
        console.error('❌ Erro ao atualizar senha:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
