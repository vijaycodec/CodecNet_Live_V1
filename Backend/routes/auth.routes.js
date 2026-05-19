import express from 'express';
import {
  login,
  verify2FA,
  refreshToken,
  logout,
  logoutAllSessions,
  requestPasswordReset,
  resetPassword,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  validateSession,
  changePassword
} from '../controllers/auth.controller.js';
import {
  loginValidator,
  verify2FAValidator,
  refreshTokenValidator,
  passwordResetRequestValidator,
  passwordResetValidator,
  changePasswordValidator,
  setup2FAValidator,
  enable2FAValidator,
  disable2FAValidator,
  validateSessionValidator
} from '../validators/auth.validator.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { authenticateToken, getClientIP, getDeviceInfo } from '../middlewares/auth.middleware.js';
import { rateLimiter, authLimiters } from '../middlewares/rateLimit.middleware.js';
// PATCH 53: Google reCAPTCHA Enterprise middleware (CWE-306 Fix)
import { verifyRecaptchaMiddleware, getRecaptchaConfig } from '../services/recaptcha.service.js';

const router = express.Router();

// Public routes (no authentication required)

/**
 * @route   POST /api/auth/login
 * @desc    User login with email/username and password
 * @access  Public
 * @rateLimit 10 requests per 15 minutes per IP
 * @security PATCH 53: reCAPTCHA Enterprise verification (CWE-306)
 */
router.post('/login',
  authLimiters.login,
  validateRequest(loginValidator, 'body'),
  verifyRecaptchaMiddleware,  // PATCH 53: Add reCAPTCHA verification before login
  login
);

/**
 * @route   POST /api/auth/verify-2fa
 * @desc    Verify two-factor authentication code
 * @access  Public (but requires user_id from login response)
 * @rateLimit 5 requests per 15 minutes per IP
 */
router.post('/verify-2fa',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 5, message: 'Too many 2FA attempts' }),
  validateRequest(verify2FAValidator, 'body'),
  verify2FA
);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public (but requires valid refresh token)
 * @rateLimit 20 requests per hour per IP
 */
router.post('/refresh-token',
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 20, message: 'Too many token refresh attempts' }),
  validateRequest(refreshTokenValidator, 'body'),
  refreshToken
);

/**
 * @route   POST /api/auth/password-reset/request
 * @desc    Request password reset (sends email with reset token)
 * @access  Public
 * @rateLimit 3 requests per hour per IP
 */
router.post('/password-reset/request',
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 3, message: 'Too many password reset requests' }),
  validateRequest(passwordResetRequestValidator, 'body'),
  requestPasswordReset
);

/**
 * @route   POST /api/auth/password-reset/confirm
 * @desc    Reset password using reset token
 * @access  Public (but requires valid reset token)
 * @rateLimit 5 requests per hour per IP
 */
router.post('/password-reset/confirm',
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many password reset attempts' }),
  validateRequest(passwordResetValidator, 'body'),
  resetPassword
);

// Protected routes (authentication required)

/**
 * @route   POST /api/auth/logout
 * @desc    Logout current session
 * @access  Private
 */
router.post('/logout',
  authenticateToken,
  logout
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all sessions
 * @access  Private
 */
router.post('/logout-all',
  authenticateToken,
  logoutAllSessions
);

/**
 * @route   GET /api/auth/validate-session
 * @desc    Validate current session and get user info
 * @access  Private
 */
router.get('/validate-session',
  authenticateToken,
  validateRequest(validateSessionValidator, 'body'),
  validateSession
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password (requires current password)
 * @access  Private
 */
router.post('/change-password',
  authenticateToken,
  validateRequest(changePasswordValidator, 'body'),
  changePassword
);

// Two-Factor Authentication routes

/**
 * @route   GET /api/auth/2fa/setup
 * @desc    Setup two-factor authentication (get QR code)
 * @access  Private
 */
router.get('/2fa/setup',
  authenticateToken,
  validateRequest(setup2FAValidator, 'body'),
  setupTwoFactor
);

/**
 * @route   POST /api/auth/2fa/enable
 * @desc    Enable two-factor authentication (verify setup)
 * @access  Private
 */
router.post('/2fa/enable',
  authenticateToken,
  validateRequest(enable2FAValidator, 'body'),
  enableTwoFactor
);

/**
 * @route   POST /api/auth/2fa/disable
 * @desc    Disable two-factor authentication
 * @access  Private
 */
router.post('/2fa/disable',
  authenticateToken,
  validateRequest(disable2FAValidator, 'body'),
  disableTwoFactor
);

// Health check and status routes

/**
 * @route   GET /api/auth/health
 * @desc    Authentication service health check
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * @route   GET /api/auth/recaptcha-config
 * @desc    Get reCAPTCHA configuration for frontend
 * @access  Public
 * @security PATCH 53: Provides reCAPTCHA site key for frontend integration
 */
router.get('/recaptcha-config', (req, res) => {
  try {
    const config = getRecaptchaConfig();
    res.status(200).json({
      success: true,
      data: config,
      message: 'reCAPTCHA configuration retrieved successfully'
    });
  } catch (error) {
    console.error('Error retrieving reCAPTCHA config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reCAPTCHA configuration',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user information
 * @access  Private
 */
router.get('/me',
  authenticateToken,
  (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        organisation_id: req.user.organisation_id,
        permissions: req.user.permissions || {},
        two_factor_enabled: req.user.two_factor_enabled || false,
        last_login_at: req.user.last_login_at,
        session_id: req.session?.id
      },
      message: 'User information retrieved successfully'
    });
  }
);

// Error handling middleware specific to auth routes
router.use((error, req, res, next) => {
  // Log security-related errors
  if (error.statusCode >= 400 && error.statusCode < 500) {
    console.warn(`Auth security event: ${error.message}`, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  // Pass error to global error handler
  next(error);
});

export default router;