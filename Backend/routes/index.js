import express from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import subscriptionPlanRoutes from "./subscriptionPlan.routes.js";
import ticketRoutes from "./ticket.routes.js";
import wazuhRoutes from "./wazuh.routes.js";
import organisationRoutes from "./organisation.routes.js";
import roleRoutes from "./role.routes.js";
import permissionRoutes from "./permission.routes.js";
import clientRoutes from "./client.routes.js";
import superadminRoutes from "./superadmin.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import assetRegisterRoutes from "./assetRegister.routes.js";
import reportsRoutes from "./reports.routes.js";
import ipGeolocationRoutes from "./ipGeolocation.routes.js"; // PATCH 47
import otxProxyRoutes from "./otxProxy.routes.js"; // PATCH 47 Extension
import newsRoutes from "./news.routes.js"; // Cybersecurity news aggregation
import riskMatrixRoutes from "./risk-matrix.routes.js"; // 3D Risk Matrix
import securityMetricsRoutes from "./security-metrics.routes.js"; // Security Metrics Dashboard
import alertNotificationRoutes from "./alertNotification.routes.js"; // Critical Alert Email Notifications
// import accessLevelRoutes from './accessLevel.routes.js';
// import accessRuleRoutes from './accessRule.routes.js';

// Import other route files as they're created
// import sessionRoutes from './session.routes.js';

const router = express.Router();

// SECURITY: Minimal public API info - no endpoint enumeration
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SOC Dashboard API",
    version: "2.0.0",
    // Endpoints removed - prevents reconnaissance attacks
  });
});

// SECURITY: Basic health check - no sensitive server info
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    // uptime, memory, environment removed - information disclosure
  });
});

// Route definitions - refresh
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/subscription-plans", subscriptionPlanRoutes);
router.use("/tickets", ticketRoutes);
router.use("/wazuh", wazuhRoutes);
router.use("/organisations", organisationRoutes);
router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);
router.use("/clients", clientRoutes);
router.use("/superadmin", superadminRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/asset-register", assetRegisterRoutes);
router.use("/reports", reportsRoutes);
router.use("/ip-geolocation", ipGeolocationRoutes); // PATCH 47: IP geolocation proxy
router.use("/otx-proxy", otxProxyRoutes); // PATCH 47: OTX threat intelligence proxy
router.use("/news", newsRoutes); // Cybersecurity news aggregation
router.use("/risk-matrix", riskMatrixRoutes); // 3D Risk Matrix (Severity × Likelihood × Impact)
router.use("/security-metrics", securityMetricsRoutes); // Security Metrics Dashboard
router.use("/alert-notifications", alertNotificationRoutes); // Critical Alert Email Notifications
// router.use("/access-levels", accessLevelRoutes);
// router.use("/access-rules", accessRuleRoutes);

// Additional routes will be added as they're created
// router.use('/assets', assetRoutes);
// router.use('/sessions', sessionRoutes);

// Handle 404 for API routes - DISABLED due to path-to-regexp error
// router.use('*', (req, res) => {
//   res.status(404).json({
//     success: false,
//     message: `API endpoint ${req.originalUrl} not found`,
//     timestamp: new Date().toISOString()
//   });
// });

export default router;
