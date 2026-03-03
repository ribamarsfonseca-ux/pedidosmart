import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient';
import { calcularFreteGeoapify } from '../services/logisticsService';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export const registerTenant = async (req: Request, res: Response): Promise<void> => {
    try {
        const { tenantName, slug, adminEmail, adminPassword, logoUrl } = req.body;

        // Validate inputs
        if (!tenantName || !slug || !adminEmail || !adminPassword) {
            res.status(400).json({ error: 'Todos os campos são obrigatórios' });
            return;
        }

        // Check if slug or email exists
        const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
        if (existingTenant) {
            res.status(400).json({ error: 'Slug do restaurante já em uso' });
            return;
        }

        const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (existingUser) {
            res.status(400).json({ error: 'E-mail do administrador já cadastrado' });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Create Tenant and Admin User transactionally
        const result = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: { name: tenantName, slug, logoUrl, active: false }, // Nasce bloqueado
            });

            const user = await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    email: adminEmail,
                    password: hashedPassword,
                    role: 'admin',
                },
            });

            return { tenant, user };
        });

        const token = jwt.sign(
            { userId: result.user.id, tenantId: result.tenant.id, role: result.user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Restaurante criado com sucesso',
            tenant: result.tenant,
            token,
        });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Erro interno ao criar restaurante' });
    }
};

export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
            return;
        }

        const user = await prisma.user.findUnique({ include: { tenant: true }, where: { email } });

        if (!user) {
            res.status(401).json({ error: 'Credenciais inválidas' });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Credenciais inválidas' });
            return;
        }

        const token = jwt.sign(
            { userId: user.id, tenantId: user.tenantId, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login realizado com sucesso',
            tenant: user.tenant,
            token,
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Erro interno durante o login' });
    }
};

// Public route to get tenant data for the Menu Application
export const getTenantBySlug = async (req: Request, res: Response): Promise<void> => {
    try {
        const { slug } = req.params;

        const tenant = await prisma.tenant.findFirst({
            where: { slug: slug as string }, // Remove active: true filter
            select: {
                id: true,
                active: true, // Adicionado
                name: true,
                slug: true,
                logoUrl: true,
                planType: true,
                description: true,
                minOrderDineIn: true,
                minOrderPickup: true,
                minOrderDelivery: true,
                deliveryFee: true,
                whatsapp: true,
                instagramUrl: true,
                facebookUrl: true,
                contactEmail: true,
                address: true,
                googleMapsUrl: true,
                openingHours: true,
                paymentMethods: true,
                primaryColor: true,
                readyMessage: true,
                extraInfo: true,
                estimatedTime: true,
                estimatedTimePickup: true,
                pdvPassword: true,
                valorKm: true,
                raioMaxKm: true,
                lat: true,
                lon: true,
                categories: {
                    orderBy: { order: 'asc' },
                    include: {
                        products: {
                            where: { active: true }
                        }
                    }
                }
            }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Restaurante não encontrado' });
            return;
        }

        res.json(tenant);
    } catch (error) {
        console.error('Get Tenant Error:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do restaurante' });
    }
};

export const updateTenant = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const {
            logoUrl,
            whatsapp,
            address,
            googleMapsUrl,
            paymentMethods,
            openingHours,
            primaryColor,
            description,
            minOrderDineIn,
            minOrderPickup,
            minOrderDelivery,
            deliveryFee,
            readyMessage,
            instagramUrl,
            facebookUrl,
            contactEmail,
            extraInfo,
            estimatedTime,
            estimatedTimeDelivery,
            estimatedTimePickup,
            pdvPassword,
            acceptDelivery,
            valorKm,
            raioMaxKm,
            lat,
            lon
        } = req.body;

        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const updatedTenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                logoUrl,
                whatsapp,
                address,
                googleMapsUrl,
                paymentMethods,
                openingHours,
                primaryColor,
                description,
                minOrderDineIn,
                minOrderPickup,
                minOrderDelivery: minOrderDelivery ? parseFloat(minOrderDelivery.toString()) : 0,
                deliveryFee: deliveryFee ? parseFloat(deliveryFee.toString()) : 0,
                readyMessage,
                instagramUrl,
                facebookUrl,
                contactEmail,
                extraInfo,
                estimatedTime,
                estimatedTimeDelivery,
                estimatedTimePickup,
                pdvPassword,
                acceptDelivery: acceptDelivery !== undefined ? Boolean(acceptDelivery) : true,
                valorKm: valorKm ? parseFloat(valorKm.toString()) : 0,
                raioMaxKm: raioMaxKm ? parseFloat(raioMaxKm.toString()) : 0,
                lat: lat ? parseFloat(lat.toString()) : null,
                lon: lon ? parseFloat(lon.toString()) : null
            }
        });

        res.json({ message: 'Configurações atualizadas', tenant: updatedTenant });
    } catch (error) {
        console.error('Update Tenant Error:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }
};
export const getCurrentTenant = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                categories: {
                    include: {
                        products: true
                    }
                }
            }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant não encontrado' });
            return;
        }

        res.json({ tenant });
    } catch (error) {
        console.error('Get Me Error:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do lojista' });
    }
};

export const changeTenantPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
            return;
        }

        const user = await prisma.user.findFirst({
            where: { tenantId, role: 'admin' }
        });

        if (!user) {
            res.status(404).json({ error: 'Usuário não encontrado.' });
            return;
        }

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            res.status(401).json({ error: 'Senha atual incorreta.' });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Senha alterada com sucesso!' });
    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({ error: 'Erro ao alterar senha.' });
    }
};

export const loginPDV = async (req: Request, res: Response): Promise<void> => {
    try {
        const { slug, pdvPassword } = req.body;

        if (!slug || !pdvPassword) {
            res.status(400).json({ error: 'Slug e senha do PDV são obrigatórios' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({ where: { slug: slug.toLowerCase() } });

        if (!tenant || tenant.pdvPassword !== pdvPassword) {
            res.status(401).json({ error: 'Credenciais de PDV inválidas' });
            return;
        }

        if (!tenant.active) {
            res.status(403).json({ error: 'Esta loja está bloqueada. Contate o administrador.' });
            return;
        }

        const token = jwt.sign(
            { tenantId: tenant.id, role: 'pdv' },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            message: 'Acesso PDV autorizado',
            tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
            token
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar login PDV' });
    }
};

export const getPDVStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        // Fuso de Brasília
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const orders = await prisma.order.findMany({
            where: { tenantId }
        });

        const pending = orders.filter(o => o.status === 'pending').length;
        const open = orders.filter(o => o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready').length;
        const finishedCount = orders.filter(o => o.status === 'finished' || o.status === 'completed').length;

        // Vendas de hoje (considerando apenas finalizados de hoje)
        const todaySales = orders.filter(o =>
            (o.status === 'finished' || o.status === 'completed') &&
            new Date(o.createdAt) >= startOfDay
        ).reduce((acc, curr) => acc + curr.totalAmount, 0);

        res.json({
            pending,
            open,
            finished: finishedCount,
            todaySales
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar métricas do PDV' });
    }
};

export const getPublicConfigs = async (req: Request, res: Response): Promise<void> => {
    try {
        const configs = await prisma.config.findMany({
            where: {
                key: { in: ['devPhone', 'devEmail', 'devName'] }
            }
        });

        const result: any = {
            geoapifyApiKey: process.env.GEOAPIFY_API_KEY || ''
        };
        configs.forEach(c => result[c.key] = c.value);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar configurações públicas' });
    }
};

/**
 * Endpoint para calcular frete dinâmico (Geoapify)
 */
export const getDeliveryFee = async (req: Request, res: Response): Promise<void> => {
    try {
        const { restauranteId, latDestino, lonDestino } = req.query;

        if (!restauranteId || !latDestino || !lonDestino) {
            res.status(400).json({ error: 'Parâmetros restauranteId, latDestino e lonDestino são obrigatórios.' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: Number(restauranteId) }
        });

        if (!tenant || !tenant.lat || !tenant.lon) {
            res.status(400).json({ error: 'Configuração de geolocalização da loja incompleta.' });
            return;
        }

        const resultado = await calcularFreteGeoapify(
            Number(latDestino),
            Number(lonDestino),
            {
                lat: tenant.lat,
                lon: tenant.lon,
                deliveryFee: tenant.deliveryFee,
                valorKm: tenant.valorKm,
                raioMaxKm: tenant.raioMaxKm
            }
        );

        res.json(resultado);

    } catch (error: any) {
        res.status(500).json({ error: 'Erro interno ao calcular frete.' });
    }
};
