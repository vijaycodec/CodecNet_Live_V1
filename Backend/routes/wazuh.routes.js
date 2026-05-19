import express from 'express';
import { getAgentsBasic, getAgentsSummary, getAgentsStream, quarantineAgent, getQuarantineStatus } from '../controllers/agents.controller.js';
import { getAlerts, getAlertsCount } from '../controllers/alerts.controller.js';
import { getDashboardMetrics } from '../controllers/dashboardMetrics.controller.js';
import { getCompliance, getComplianceFramework } from '../controllers/compliance.controller.js';
import {
  getMitreGroups,
  getMitreMitigations,
  getMitreSoftware,
  getMitreTactics,
  getMitreTechniques,
  getMitreCoverage,
  getMitreStatistics
} from '../controllers/mitre.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { organisationScope } from '../middlewares/organisationScope.middleware.js';
import { fetchClientCred } from '../middlewares/fetchClientCredentials.js';
import { rateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(organisationScope({}));
router.use(fetchClientCred);

// PATCH 15 (SECURITY): Test endpoint removed - use authenticated endpoints only
// If debugging is needed in development, check logs or use specific endpoints with valid auth

// Agents routes
router.get("/agents-basic", getAgentsBasic); // Fast endpoint - basic info only
router.get("/agents-summary", getAgentsSummary); // Slower endpoint - includes SCA/CIS/vulnerabilities
router.get("/agents-stream", getAgentsStream); // SSE endpoint - real-time streaming
router.put("/agent/quarantine", quarantineAgent);
router.get("/agent/:agentId/quarantine-status", getQuarantineStatus);

// Alerts routes
router.get("/alerts/count", getAlertsCount);  // Count endpoint (must be before /alerts route)
router.get("/alerts", getAlerts);

// Dashboard metrics routes
router.get("/dashboard-metrics", getDashboardMetrics);

// Compliance routes
router.get("/compliance", getCompliance);
router.get("/compliance/:framework", getComplianceFramework);

// MITRE ATT&CK routes
router.get("/mitre/groups", getMitreGroups);
router.get("/mitre/mitigations", getMitreMitigations);
router.get("/mitre/software", getMitreSoftware);
router.get("/mitre/tactics", getMitreTactics);
router.get("/mitre/techniques", getMitreTechniques);
router.get("/mitre/coverage", getMitreCoverage);
router.get("/mitre/statistics", getMitreStatistics);

export default router;