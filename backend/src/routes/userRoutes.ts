import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateToken, userController.getUsers);
router.post('/', authenticateToken, userController.createUser);
router.delete('/:id', authenticateToken, userController.deleteUser);

export default router;
