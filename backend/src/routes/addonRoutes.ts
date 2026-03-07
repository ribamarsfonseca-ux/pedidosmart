import express from 'express';
import * as addonController from '../controllers/addonController';
import { authenticateToken } from '../middlewares/auth';

const router = express.Router();

// Middleware applied to all routes in this file
router.use(authenticateToken);

// Addon Groups
router.get('/groups', addonController.getAddonGroups);
router.post('/groups', addonController.createAddonGroup);
router.put('/groups/:id', addonController.updateAddonGroup);
router.delete('/groups/:id', addonController.deleteAddonGroup);

// Addons
router.post('/', addonController.createAddon);
router.put('/:id', addonController.updateAddon);
router.delete('/:id', addonController.deleteAddon);

export default router;
