import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import hasPermission from '../middlewares/permission.middleware.js';
import { getRiskMatrixData, get3DRiskMatrix } from '../controllers/riskMatrix.controller.js';

const router = express.Router();

// Get 3D risk matrix data - Severity × Likelihood × Impact
router.get('/data', protect, hasPermission('risk-matrix:read'), getRiskMatrixData);

// Get 3D risk matrix visualization data
router.get('/3d', protect, hasPermission('risk-matrix:read'), get3DRiskMatrix);

export default router;