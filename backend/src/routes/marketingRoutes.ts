import { Router } from 'express';
import * as marketingController from '../controllers/marketingController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// Rotas Protegidas (Lojista)
router.get('/coupons', authenticateToken, marketingController.getCoupons);
router.post('/coupons', authenticateToken, marketingController.createCoupon);
router.delete('/coupons/:id', authenticateToken, marketingController.deleteCoupon);

router.get('/customers', authenticateToken, marketingController.getCustomers);
router.get('/customers/:phone', authenticateToken, marketingController.getCustomerDetail);

// Rota Pública (Cardápio Cliente)
router.post('/coupons/validate', marketingController.validateCoupon);

export default router;
