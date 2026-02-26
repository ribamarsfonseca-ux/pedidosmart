import { Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient';

export const checkSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Assume simplified: tenantId is attached to req by authMiddleware
        const tenantId = (req as any).tenantId;

        if (!tenantId) {
            next();
            return;
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { active: true, subscriptionStatus: true, nextBillingDate: true, trialEndsAt: true }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Restaurante não encontrado' });
            return;
        }

        const now = new Date();

        // 1. Check if manually deactivated
        if (!tenant.active) {
            res.status(403).json({
                error: 'Sua conta está desativada. Entre em contato com o suporte.',
                code: 'ACCOUNT_DEACTIVATED'
            });
            return;
        }

        // 2. Check if subscription is canceled
        if (tenant.subscriptionStatus === 'canceled') {
            res.status(403).json({
                error: 'Sua assinatura foi cancelada. Reative para continuar usando.',
                code: 'SUBSCRIPTION_CANCELED'
            });
            return;
        }

        // 3. Check Trial and Expiration
        const isTrialExpired = tenant.subscriptionStatus === 'trial' && now > tenant.trialEndsAt;
        const isSubscriptionExpired = tenant.subscriptionStatus === 'past_due' && tenant.nextBillingDate && now > tenant.nextBillingDate;

        if (isTrialExpired || isSubscriptionExpired) {
            res.status(403).json({
                error: 'Seu período de acesso expirou. Realize o pagamento para continuar.',
                code: 'SUBSCRIPTION_EXPIRED',
                expiredAt: isTrialExpired ? tenant.trialEndsAt : tenant.nextBillingDate
            });
            return;
        }

        next();
    } catch (error) {
        console.error('Subscription Check Error:', error);
        res.status(500).json({ error: 'Erro ao verificar status da assinatura' });
    }
};
