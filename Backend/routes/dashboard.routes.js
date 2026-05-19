import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { fetchClientCred } from '../middlewares/fetchClientCredentials.js';
import {getDashboardMetrics, getAgentsSummary, getAlerts} from '../controllers/dashboardController.js';

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);
router.use(fetchClientCred);

// Dashboard metrics
router.get('/metrics', protect, getDashboardMetrics);

// Agents endpoints
router.get('/agents',protect, getAgentsSummary);

// Alerts endpoints
router.get('/alerts',protect,  getAlerts);

export default router;