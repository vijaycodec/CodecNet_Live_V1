import express from 'express';
import { getSecurityMetrics } from '../controllers/securityMetrics.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import hasPermission from '../middlewares/permission.middleware.js';

const router = express.Router();

// Get security metrics dashboard data
// Uses risk-matrix:read permission (same as the risk matrix page)
router.get('/dashboard', protect, hasPermission('risk-matrix:read'), getSecurityMetrics);

export default router;
