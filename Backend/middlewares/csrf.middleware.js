import crypto from 'crypto';
import { ApiError } from '../utils/ApiError.js';

/**
 * CSRF Protection Middleware
 *
 * This middleware provides Cross-Site Request Forgery (CSRF) protection for state-changing operations.
 * While JWT Bearer token authentication provides some protection against CSRF attacks (as browsers
 * don't automatically send Authorization headers), this middleware adds an additional layer of security.
 *
 * Implementation Notes:
 * - Uses double-submit cookie pattern
 * - CSRF tokens are generated server-side and validated on state-changing requests
 * - Tokens are stored in HTTP-only cookies to prevent XSS attacks
 * - Safe methods (GET, HEAD, OPTIONS) bypass CSRF validation
 *
 * Usage:
 * 1. Add generateCsrfToken middleware to routes that need CSRF tokens (typically login/session endpoints)
 * 2. Add validateCsrfToken middleware to routes that perform state-changing operations (POST, PUT, DELETE, PATCH)
 */

// Store for CSRF tokens (in production, use Redis or similar)
const csrfTokenStore = new Map();

// Token expiration time (15 minutes)
const TOKEN_EXPIRATION = 15 * 60 * 1000;

/**
 * Generate a cryptographically secure CSRF token
 * @returns {string} - Base64URL encoded token
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString('base64url');
};

/**
 * Middleware to generate and send CSRF token to client
 * Call this on routes where you need to provide a CSRF token (e.g., after login)
 */
export const generateCsrfToken = (req, res, next) => {
  try {
    // Generate token
    const token = generateToken();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Store token with expiration
    csrfTokenStore.set(tokenHash, {
      createdAt: Date.now(),
      userId: req.user?.id, // Optional: bind to specific user
    });

    // Clean up expired tokens periodically
    cleanupExpiredTokens();

    // Send token in response header and as HTTP-only cookie
    res.setHeader('X-CSRF-Token', token);
    res.cookie('CSRF-TOKEN', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
      sameSite: 'strict',
      maxAge: TOKEN_EXPIRATION,
    });

    // Also attach to response locals for use in views/APIs
    res.locals.csrfToken = token;

    next();
  } catch (error) {
    next(new ApiError(500, 'Failed to generate CSRF token'));
  }
};

/**
 * Middleware to validate CSRF token on incoming requests
 * Apply this to routes that perform state-changing operations
 */
export const validateCsrfToken = (req, res, next) => {
  try {
    // Skip CSRF validation for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Get token from header or body
    const token = req.headers['x-csrf-token'] ||
                  req.body?._csrf ||
                  req.query?._csrf;

    if (!token) {
      throw new ApiError(403, 'CSRF token missing');
    }

    // Hash the token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Validate token exists and hasn't expired
    const storedToken = csrfTokenStore.get(tokenHash);

    if (!storedToken) {
      throw new ApiError(403, 'Invalid CSRF token');
    }

    // Check expiration
    if (Date.now() - storedToken.createdAt > TOKEN_EXPIRATION) {
      csrfTokenStore.delete(tokenHash);
      throw new ApiError(403, 'CSRF token expired');
    }

    // Optional: Validate token is for the current user
    if (storedToken.userId && req.user?.id && storedToken.userId !== req.user.id) {
      throw new ApiError(403, 'CSRF token does not match user session');
    }

    // Token is valid, remove it (one-time use)
    csrfTokenStore.delete(tokenHash);

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'CSRF validation failed',
    });
  }
};

/**
 * Cleanup expired CSRF tokens
 * This prevents memory leaks from abandoned tokens
 */
const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [hash, data] of csrfTokenStore.entries()) {
    if (now - data.createdAt > TOKEN_EXPIRATION) {
      csrfTokenStore.delete(hash);
    }
  }
};

/**
 * Middleware to attach CSRF token to response for API endpoints
 * This is useful for SPAs that need the token for subsequent requests
 */
export const provideCsrfToken = (req, res, next) => {
  const token = generateToken();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  csrfTokenStore.set(tokenHash, {
    createdAt: Date.now(),
    userId: req.user?.id,
  });

  // Attach to response
  res.locals.csrfToken = token;

  // Also send in header
  res.setHeader('X-CSRF-Token', token);

  next();
};

/**
 * Get CSRF token endpoint
 * Use this to provide a dedicated endpoint for fetching CSRF tokens
 */
export const getCsrfToken = (req, res) => {
  const token = generateToken();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  csrfTokenStore.set(tokenHash, {
    createdAt: Date.now(),
    userId: req.user?.id,
  });

  cleanupExpiredTokens();

  res.json({
    success: true,
    csrfToken: token,
  });
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredTokens, 5 * 60 * 1000);

export default {
  generateCsrfToken,
  validateCsrfToken,
  provideCsrfToken,
  getCsrfToken,
};
