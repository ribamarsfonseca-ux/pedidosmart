import express from 'express';
import tenantRoutes from './tenantRoutes';
import categoryRoutes from './categoryRoutes';
import productRoutes from './productRoutes';
import orderRoutes from './orderRoutes';
import { checkSubscription } from '../middlewares/subscriptionMiddleware';
import * as superAdmin from '../controllers/superAdminController';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Welcome to SmartPedidos Core API' });
});

// Authentication and Public Tenant Routes
router.use('/tenants', tenantRoutes);

// Super Admin Routes (Controle de faturamento e assinaturas)
router.get('/super-admin/tenants', superAdmin.getAllTenants);
router.put('/super-admin/tenant/:id', superAdmin.updateTenantStatus);

// Protected Admin Routes - Com verificação de assinatura e status
router.use('/categories', checkSubscription, categoryRoutes);
router.use('/products', checkSubscription, productRoutes);
router.use('/orders', checkSubscription, orderRoutes);

export default router;
