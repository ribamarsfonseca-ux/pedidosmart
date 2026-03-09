import { Request, Response } from 'express';
import prisma from '../prismaClient';
import bcrypt from 'bcryptjs';

// Esse controlador é para VOCÊ usar para gerenciar seus clientes
export const getAllTenants = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenants = await prisma.tenant.findMany({
            include: {
                _count: {
                    select: { products: true, orders: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tenants);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar restaurantes' });
    }
};

export const updateTenantStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { active, subscriptionStatus, planType, nextBillingDate } = req.body;

        const tenant = await prisma.tenant.update({
            where: { id: parseInt(id as string) },
            data: {
                active,
                subscriptionStatus,
                planType,
                nextBillingDate: nextBillingDate ? new Date(nextBillingDate) : undefined
            }
        });

        res.json({ message: 'Status do restaurante atualizado', tenant });
    } catch (error) {
        console.error('Update Tenant Status Error:', error);
        res.status(500).json({ error: 'Erro ao atualizar restaurante' });
    }
};

export const setTenantGeoKey = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { geoapifyApiKey } = req.body;

        const tenant = await prisma.tenant.update({
            where: { id: parseInt(id as string) },
            data: { geoapifyApiKey: geoapifyApiKey ?? '' }
        });

        res.json({ message: 'Chave Geoapify atualizada', tenant });
    } catch (error) {
        console.error('Set GeoKey Error:', error);
        res.status(500).json({ error: 'Erro ao atualizar chave Geoapify' });
    }
};

export const resetTenantPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Find the admin user of this tenant
        const user = await prisma.user.findFirst({
            where: { tenantId: parseInt(id as string), role: 'admin' }
        });

        if (!user) {
            res.status(404).json({ error: 'Usuário admin não encontrado para este restaurante.' });
            return;
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Senha resetada com sucesso!' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ error: 'Erro ao resetar senha.' });
    }
};

export const changeMasterPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
            return;
        }

        // Salva ou atualiza a senha mestra na tabela Config
        await prisma.config.upsert({
            where: { key: 'SUPER_ADMIN_PASSWORD' },
            update: { value: newPassword },
            create: { key: 'SUPER_ADMIN_PASSWORD', value: newPassword }
        });

        res.json({ message: 'Senha mestra do Super Admin alterada com sucesso! Use a nova senha no próximo login.' });
    } catch (error) {
        console.error('Change Master Password Error:', error);
        res.status(500).json({ error: 'Erro ao alterar senha do Super Admin.' });
    }
};

export const getConfigs = async (req: Request, res: Response): Promise<void> => {
    try {
        const configs = await prisma.config.findMany();
        // Transforma array de [{key, value}] em objeto {key: value}
        const configMap = configs.reduce((acc: any, curr) => {
            if (curr.key !== 'SUPER_ADMIN_PASSWORD') { // Não expõe a senha mestra
                acc[curr.key] = curr.value;
            }
            return acc;
        }, {});
        res.json(configMap);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
};

export const updateConfigs = async (req: Request, res: Response): Promise<void> => {
    try {
        const updates = req.body; // { devPhone: '...', devEmail: '...', devName: '...' }

        for (const [key, value] of Object.entries(updates)) {
            if (key === 'SUPER_ADMIN_PASSWORD') continue; // Proteção extra

            await prisma.config.upsert({
                where: { key },
                update: { value: value as string },
                create: { key, value: value as string }
            });
        }

        res.json({ message: 'Configurações atualizadas com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
};

export const createTenant = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, slug, ownerName, adminEmail, adminPassword } = req.body;

        if (!name || !slug || !adminEmail || !adminPassword) {
            res.status(400).json({ error: 'Todos os campos obrigatórios (nome, slug, email, senha) não foram preenchidos' });
            return;
        }

        const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
        if (existingTenant) {
            res.status(400).json({ error: 'Slug já em uso' });
            return;
        }

        const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (existingUser) {
            res.status(400).json({ error: 'E-mail já cadastrado' });
            return;
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const result = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: { name, slug, ownerName: ownerName || null, active: true, subscriptionStatus: 'active' }
            });

            await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    email: adminEmail,
                    password: hashedPassword,
                    role: 'admin'
                }
            });

            return tenant;
        });

        res.status(201).json({ message: 'Empresa cadastrada com sucesso!', tenant: result });
    } catch (error) {
        console.error('Create Tenant Error:', error);
        res.status(500).json({ error: 'Erro ao cadastrar empresa' });
    }
};

export const deleteTenant = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        // Ensure tenant exists
        const tenant = await prisma.tenant.findUnique({
            where: { id: parseInt(id as string) }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Restaurante não encontrado' });
            return;
        }

        // Deleting the tenant will cascade delete all users, products, categories, orders, tables, and drivers 
        // because of the onDelete: Cascade rule we set in prisma schema.
        await prisma.tenant.delete({
            where: { id: parseInt(id as string) }
        });

        res.json({ message: 'Restaurante excluído com sucesso!' });
    } catch (error) {
        console.error('Delete Tenant Error:', error);
        res.status(500).json({ error: 'Erro ao excluir o restaurante' });
    }
};

export const deleteTenantDailyOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const tenantId = parseInt(id as string);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const result = await prisma.order.deleteMany({
            where: { tenantId, createdAt: { gte: today, lt: tomorrow } }
        });

        res.json({ message: `Histórico do dia zerado para o lojista. ${result.count} pedido(s) removido(s).` });
    } catch (error) {
        console.error('Superadmin Delete Daily Error:', error);
        res.status(500).json({ error: 'Erro ao zerar histórico diário.' });
    }
};

export const deleteTenantAllOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const tenantId = parseInt(id as string);

        const result = await prisma.order.deleteMany({ where: { tenantId } });

        res.json({ message: `Todo histórico zerado para o lojista. ${result.count} pedido(s) removido(s).` });
    } catch (error) {
        console.error('Superadmin Delete All Error:', error);
        res.status(500).json({ error: 'Erro ao zerar histórico completo.' });
    }
};
