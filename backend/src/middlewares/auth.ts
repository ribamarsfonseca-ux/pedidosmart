import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Extend the Express Request to include our custom user payload
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: number;
                tenantId: number;
                role: string;
            };
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    // Support token in query string for downloads
    const token = (authHeader && authHeader.split(' ')[1]) || (req.query.token as string);

    if (!token) {
        res.status(401).json({ error: 'Token de acesso não fornecido' });
        return;
    }

    jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (err) {
            res.status(403).json({ error: 'Token de acesso inválido ou expirado' });
            return;
        }

        // Attach the decoded token payload to the request object
        req.user = userPayload as any;
        next();
    });
};
