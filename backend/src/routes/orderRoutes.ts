import { Router } from 'express';
import { createOrder, getOrders, updateOrderStatus, getOrderPublicStatus, exportOrdersBackup, deleteAllOrders, deleteDailyOrders, voidOrder } from '../controllers/orderController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// Rota pública para os clientes criarem um pedido ao finalizar o carrinho
router.post('/create', createOrder);
router.get('/:id/status_public', getOrderPublicStatus);
router.put('/:id/request-cancel', require('../controllers/orderController').requestCancellation);

// As próximas rotas requerem o Admin logado
router.use(authenticateToken);

router.get('/', getOrders);
router.post('/', createOrder);
router.get('/backup', exportOrdersBackup);
router.get('/crm/dashboard', authenticateToken, require('../controllers/orderController').getCRMDashboard);
router.get('/crm/customers/export', authenticateToken, require('../controllers/orderController').exportCustomersCRM);
router.get('/:id/receipt', authenticateToken, require('../controllers/orderController').getThermalReceipt);
router.put('/:id/status', updateOrderStatus);
router.patch('/:id/status', updateOrderStatus);

// Admin Deletion Routes (Protegidas por senha no body, ver controller)
router.put('/:id/void', voidOrder);
router.delete('/delete-all', deleteAllOrders);
router.delete('/delete-daily', deleteDailyOrders);

export default router;
