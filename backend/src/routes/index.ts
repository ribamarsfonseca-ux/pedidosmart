import express from 'express';
import tenantRoutes from './tenantRoutes';
import categoryRoutes from './categoryRoutes';
import productRoutes from './productRoutes';
import orderRoutes from './orderRoutes';
import addonRoutes from './addonRoutes';
import cashRegisterRoutes from './cashRegisterRoutes';
import marketingRoutes from './marketingRoutes';
import tableRoutes from './tableRoutes';
import userRoutes from './userRoutes';
import { checkSubscription } from '../middlewares/subscriptionMiddleware';
import * as superAdmin from '../controllers/superAdminController';
import { superAdminAuth } from '../middlewares/superAdminAuth';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Bem-vindo à API do SmartPedidos' });
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
router.delete('/super-admin/tenant/:id', superAdminAuth, superAdmin.deleteTenant);
router.put('/super-admin/tenant/:id/geo-key', superAdminAuth, superAdmin.setTenantGeoKey);
router.delete('/super-admin/tenant/:id/orders-daily', superAdminAuth, superAdmin.deleteTenantDailyOrders);
router.delete('/super-admin/tenant/:id/orders-all', superAdminAuth, superAdmin.deleteTenantAllOrders);

// Protected Admin Routes - Com verificação de assinatura e status
router.use('/categories', checkSubscription, categoryRoutes);
router.use('/products', checkSubscription, productRoutes);
router.use('/orders', checkSubscription, orderRoutes);
router.use('/addons', checkSubscription, addonRoutes);
router.use('/tables', checkSubscription, tableRoutes);
router.use('/users', checkSubscription, userRoutes);
router.use('/logistics', checkSubscription, require('./logisticsRoutes').default);
router.use('/cash-register', checkSubscription, cashRegisterRoutes);
router.use('/marketing', checkSubscription, marketingRoutes);

export default router;
