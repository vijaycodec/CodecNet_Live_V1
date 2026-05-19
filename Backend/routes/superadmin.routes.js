import express from 'express';
import { accessClientDashboard } from '../controllers/superadmin.controller.js';
import { verifySuperAdmin } from '../middlewares/superadminAccess.middleware.js';

const router = express.Router();

// Single endpoint for dashboard access
router.get('/client/:clientId/dashboard', verifySuperAdmin, accessClientDashboard);

export default router;