import { Router } from 'express';
import { createOrder, getOrders, updateOrderStatus } from '../controllers/orderController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// Rota pública para os clientes criarem um pedido ao finalizar o carrinho
router.post('/create', createOrder);

// As próximas rotas requerem o Admin logado
router.use(authenticateToken);

router.get('/', getOrders);
router.put('/:id/status', updateOrderStatus);

export default router;
