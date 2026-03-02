import { Router } from 'express';
import { registerTenant, loginAdmin, getTenantBySlug, updateTenant, getCurrentTenant, changeTenantPassword } from '../controllers/tenantController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// Public Auth Routes
router.post('/register', registerTenant);
router.post('/login', loginAdmin);

// Public Menu Route (accessed by customers via /:slug URL)
router.get('/menu/:slug', getTenantBySlug);

// Private Settings Route
router.get('/me', authenticateToken, getCurrentTenant);
router.put('/update', authenticateToken, updateTenant);
router.put('/change-password', authenticateToken, changeTenantPassword);

export default router;
