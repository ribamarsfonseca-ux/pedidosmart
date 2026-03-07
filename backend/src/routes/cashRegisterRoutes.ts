import { Router } from 'express';
import * as cashRegisterController from '../controllers/cashRegisterController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// Todas as rotas de caixa exigem autenticação do lojista
router.use(authenticateToken);

router.post('/events', cashRegisterController.createEvent);
router.get('/daily-summary', cashRegisterController.getDailyEvents);

export default router;
