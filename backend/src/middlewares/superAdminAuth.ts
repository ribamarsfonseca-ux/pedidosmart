import { Request, Response, NextFunction } from 'express';

export const superAdminAuth = (req: Request, res: Response, next: NextFunction): void => {
    const adminPassword = req.headers['x-admin-password'];
    const expectedPassword = process.env.SUPER_ADMIN_PASSWORD;

    if (!adminPassword || adminPassword !== expectedPassword) {
        res.status(401).json({ error: 'Acesso negado: Senha de Super Admin inválida ou ausente.' });
        return;
    }

    next();
};
