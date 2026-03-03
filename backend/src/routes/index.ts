import express from 'express';
import tenantRoutes from './tenantRoutes';
import categoryRoutes from './categoryRoutes';
import productRoutes from './productRoutes';
import orderRoutes from './orderRoutes';
import { checkSubscription } from '../middlewares/subscriptionMiddleware';
import * as superAdmin from '../controllers/superAdminController';
import { superAdminAuth } from '../middlewares/superAdminAuth';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Welcome to SmartPedidos Core API' });
});

// Authentication and Public Tenant Routes
router.use('/tenants', tenantRoutes);

// Super Admin Routes
router.get('/super-admin/tenants', superAdminAuth, superAdmin.getAllTenants);
router.put('/super-admin/tenant/:id', superAdminAuth, superAdmin.updateTenantStatus);
router.post('/super-admin/tenant/:id/reset-password', superAdminAuth, superAdmin.resetTenantPassword);
router.post('/super-admin/change-password', superAdminAuth, superAdmin.changeMasterPassword);
router.get('/super-admin/config', superAdminAuth, superAdmin.getConfigs);
router.post('/super-admin/config', superAdminAuth, superAdmin.updateConfigs);
router.post('/super-admin/tenant', superAdminAuth, superAdmin.createTenant);

// Protected Admin Routes - Com verificação de assinatura e status
router.use('/categories', checkSubscription, categoryRoutes);
router.use('/products', checkSubscription, productRoutes);
router.use('/orders', checkSubscription, orderRoutes);
router.use('/tables', checkSubscription, require('./tableRoutes').default);
router.use('/logistics', checkSubscription, require('./logisticsRoutes').default);

export default router;
