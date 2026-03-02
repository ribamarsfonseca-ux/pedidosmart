import { Router } from 'express';
import { registerTenant, loginAdmin, getTenantBySlug, updateTenant, getCurrentTenant, changeTenantPassword, loginPDV, getPDVStats, getPublicConfigs } from '../controllers/tenantController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// Public Auth Routes
router.post('/register', registerTenant);
router.post('/login', loginAdmin);

// Public Menu Route (accessed by customers via /:slug URL)
router.get('/menu/:slug', getTenantBySlug);
router.get('/public-configs', getPublicConfigs); // Nova rota pública para dados do dev

// Private Settings & PDV Routes
router.get('/me', authenticateToken, getCurrentTenant);
router.put('/update', authenticateToken, updateTenant);
router.put('/change-password', authenticateToken, changeTenantPassword);
router.get('/pdv/stats', authenticateToken, getPDVStats);
router.post('/pdv/login', loginPDV);

export default router;
