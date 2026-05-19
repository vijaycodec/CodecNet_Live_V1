import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './user.routes.js';
import roleRoutes from './role.routes.js';
import permissionRoutes from './permission.routes.js';
import accessLevelRoutes from './accessLevel.routes.js';
// PATCH 1: Removed accessRule routes (tier-based access system removed)
// import accessRuleRoutes from './accessRule.routes.js';
import clientRoutes from './client.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import superAdminRoutes from './superadmin.routes.js';
import ticketRoutes from './ticket.routes.js';
import wazuhRoutes from './wazuh.routes.js';
import riskMatrixRoutes from './risk-matrix.routes.js';
const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/level', accessLevelRoutes);
// PATCH 1: Access rules system removed
// router.use('/rule', accessRuleRoutes);
router.use('/client', clientRoutes);
router.use('/dashboard', dashboardRoutes);  // Changed from '/' to '/dashboard'
router.use('/', superAdminRoutes);  // Changed from '/' to '/dashboard'
router.use('/tickets', ticketRoutes);
router.use('/wazuh', wazuhRoutes);
router.use('/risk-matrix', riskMatrixRoutes);

export default router;