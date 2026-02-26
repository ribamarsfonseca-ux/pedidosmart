import { Router } from 'express';
import { registerTenant, loginAdmin, getTenantBySlug } from '../controllers/tenantController';

const router = Router();

// Public Auth Routes
router.post('/register', registerTenant);
router.post('/login', loginAdmin);

// Public Menu Route (accessed by customers via /:slug URL)
router.get('/menu/:slug', getTenantBySlug);

export default router;
