import { Router } from 'express';
import { createOrder, getOrders, updateOrderStatus, getOrderPublicStatus, exportOrdersBackup } from '../controllers/orderController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// Rota pública para os clientes criarem um pedido ao finalizar o carrinho
router.post('/create', createOrder);
router.get('/:id/status_public', getOrderPublicStatus);

// As próximas rotas requerem o Admin logado
router.use(authenticateToken);

router.get('/', getOrders);
router.get('/backup', exportOrdersBackup);
router.put('/:id/status', updateOrderStatus);

export default router;
