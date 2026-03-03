import express from 'express';
import * as logisticsController from '../controllers/logisticsController';
import { authenticateToken } from '../middlewares/auth';

const router = express.Router();

router.get('/drivers', authenticateToken, logisticsController.getDrivers);
router.post('/drivers', authenticateToken, logisticsController.createDriver);
router.put('/drivers/:id/status', authenticateToken, logisticsController.updateDriverStatus);
router.delete('/drivers/:id', authenticateToken, logisticsController.deleteDriver);

export default router;
