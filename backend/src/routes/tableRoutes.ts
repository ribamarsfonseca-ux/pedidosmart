import express from 'express';
import * as tableController from '../controllers/tableController';
import { authenticateToken } from '../middlewares/auth';

const router = express.Router();

router.get('/', authenticateToken, tableController.getTables);
router.post('/', authenticateToken, tableController.createTable);
router.delete('/:id', authenticateToken, tableController.deleteTable);

export default router;
