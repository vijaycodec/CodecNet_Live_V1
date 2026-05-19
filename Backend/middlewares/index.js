/**
 * Comprehensive middleware exports for SOC Dashboard
 * Provides all authentication, authorization, validation, and utility middlewares
 */

// Authentication middlewares
export {
  authenticateToken,
  optionalAuth,
  requireAuthMethod,
  requireVerifiedEmail,
  protect, // Legacy compatibility
  getClientIP,
  getDeviceInfo,
} from "./auth.middleware.minimal.js";

import {
  globalErrorHandler,
  notFoundHandler,
} from "./errorHandler.middleware.js";

// Authorization middlewares
export {
  authorizePermissions,
  organisationScope,
  checkResourceOwnership,
  requireRole,
  requireFeature,
  checkSubscriptionLimits,
  hasPermission,
  getUserPermissions,
} from "./authorization.middleware.js";

// Organization scope middlewares
// export {
//   organisationScope as orgScope
// } from './organisationScope.middleware.js';

// Rate limiting middlewares
export {
  rateLimiter,
  authLimiters,
  apiLimiters,
  userRateLimiter,
  orgRateLimiter,
  adaptiveRateLimiter,
  createRateLimiter,
  authRateLimit,
  apiRateLimit,
} from "./rateLimit.middleware.js";

// Validation middlewares
export {
  validateRequest,
  validateMultiple,
  validateParam,
  validateId,
  validateQuery,
  validateFileUpload,
  validateCustom,
  sanitizeInput,
  commonSchemas,
} from "./validation.middleware.js";

// Error handling middlewares
export {
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
} from "./errorHandler.middleware.js";

// Legacy middleware exports for backward compatibility
// These are deprecated and should be replaced with new equivalents
// export { default as loginLimiter } from './rateLimit.middleware.js'; // Use authLimiters.login instead

/**
 * Common middleware combinations for easy use
 */

// Standard authentication + organization scope
// export const standardAuth = [
//   authenticateToken,
//   organisationScope({})
// ];

// Admin authentication with permissions
// export const adminAuth = (permissions = []) => [
//   authenticateToken,
//   authorizePermissions(permissions),
//   organisationScope({})
// ];

// API authentication with rate limiting
// export const apiAuth = (limitConfig = {}) => [
//   rateLimiter(limitConfig),
//   authenticateToken
// ];

// File upload with validation
// export const fileUpload = (uploadConfig = {}) => [
//   authenticateToken,
//   validateFileUpload(uploadConfig)
// ];

// Search endpoints with rate limiting
// export const searchEndpoint = [
//   authenticateToken,
//   apiLimiters.search,
//   organisationScope({})
// ];

// Create endpoints with stricter limits
// export const createEndpoint = (permissions = []) => [
//   authenticateToken,
//   apiLimiters.create,
//   authorizePermissions(permissions),
//   organisationScope({})
// ];

/**
 * Middleware setup helpers
 */

// Setup all error handling middleware
export const setupErrorHandling = (app) => {
  // Development and production error handling is built into globalErrorHandler

  // 404 handler (must be before global error handler)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(globalErrorHandler);
};

// Setup basic security middleware
export const setupSecurity = (app) => {
  // Basic rate limiting for all requests
  // app.use(rateLimiter({ max: 1000, windowMs: 15 * 60 * 1000 }));
};

/**
 * Migration notes for developers:
 *
 * Old middleware -> New middleware replacements:
 * - level.middleware.js -> Use authorizePermissions() with role-based permissions
 * - role.middleware.js -> Use requireRole() or authorizePermissions()
 * - permission.middleware.js -> Use authorizePermissions()
 * - superadminAccess.middleware.js -> Use authenticateToken + req.user.is_super_admin check
 * - validate.middleware.js -> Use validateRequest() from validation.middleware.js
 * - dynamicTierAccess.middleware.js -> Use requireFeature() or checkSubscriptionLimits()
 * - fetchClientCredentials.js -> Integrated into new auth.middleware.js
 *
 * Usage examples:
 *
 * // Old way:
 * router.use(protect);
 * router.use(hasPermission('user:read'));
 * router.use(isSuperAdmin);
 *
 * // New way:
 * router.use(authenticateToken);
 * router.use(authorizePermissions(['user:read']));
 * // Super admin check is automatic in authorizePermissions
 *
 * // Route-specific examples:
 * router.get('/users', ...standardAuth, getAllUsers);
 * router.post('/users', ...createEndpoint(['user:create']), createUser);
 * router.get('/admin/stats', ...adminAuth(['admin:read']), getAdminStats);
 */

export default {
  // Authentication
  // authenticateToken,
  // optionalAuth,
  // requireAuthMethod,
  // requireVerifiedEmail,
  // Authorization
  // authorizePermissions,
  // organisationScope,
  // requireRole,
  // requireFeature,
  // checkSubscriptionLimits,
  // Rate limiting
  // rateLimiter,
  // authLimiters,
  // apiLimiters,
  // Validation
  // validateRequest,
  // validateQuery,
  // validateFileUpload,
  // sanitizeInput,
  // Error handling
  // globalErrorHandler,
  // notFoundHandler,
  // asyncHandler,
  // Utilities
  // setupErrorHandling,
  // setupSecurity
};
