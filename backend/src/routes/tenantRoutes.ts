import { Router } from 'express';
import { registerTenant, loginAdmin, getTenantBySlug, updateTenant, getCurrentTenant, changeTenantPassword, loginPDV, getPDVStats, getPublicConfigs, getDeliveryFee } from '../controllers/tenantController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// Public Auth Routes
router.post('/register', registerTenant);
router.post('/login', loginAdmin);

// Public Menu & Services Routes
router.get('/menu/:slug', getTenantBySlug);
router.get('/public-configs', getPublicConfigs);
router.get('/calcular-entrega', getDeliveryFee); // Nova rota de frete inteligente

// Private Settings & PDV Routes
router.get('/me', authenticateToken, getCurrentTenant);
router.put('/update', authenticateToken, updateTenant);
router.put('/change-password', authenticateToken, changeTenantPassword);
router.get('/pdv/stats', authenticateToken, getPDVStats);
router.post('/pdv/login', loginPDV);

export default router;
