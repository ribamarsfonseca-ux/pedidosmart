import { Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient';

export const superAdminAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const adminPassword = req.headers['x-admin-password'];

    // Busca senha no banco (tabela Config)
    const dbConfig = await prisma.config.findUnique({
        where: { key: 'SUPER_ADMIN_PASSWORD' }
    });

    const expectedPassword = dbConfig?.value || process.env.SUPER_ADMIN_PASSWORD;

    if (!adminPassword || adminPassword !== expectedPassword) {
        res.status(401).json({ error: 'Acesso negado: Senha de Super Admin inválida ou ausente.' });
        return;
    }

    next();
};
