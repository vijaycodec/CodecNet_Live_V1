import rateLimit from 'express-rate-limit';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * IPv6-safe IP address extractor
 * Handles IPv6 addresses properly by normalizing them
 */
const getClientIp = (req) => {
  // Get IP from Express (already handles trust proxy)
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';

  // Normalize IPv6 addresses
  // Convert IPv4-mapped IPv6 (::ffff:192.168.1.1) to IPv4 (192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }

  return ip;
};

/**
 * Generic rate limiter factory
 */
export const rateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = Math.ceil(options.windowMs / 1000) || 900;
      return res.status(429).json(
        new ApiResponse(
          429, 
          null, 
          `Too many requests. Please try again in ${retryAfter} seconds.`,
          { retry_after: retryAfter }
        )
      );
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
};

/**
 * Authentication-specific rate limiters
 */
export const authLimiters = {
  // PATCH 61: Per-user login rate limiting (IP + identifier)
  // Prevents one user from blocking others on the same IP
  login: rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per user per IP
    skipSuccessfulRequests: true,
    // PATCH 61: Composite key (IP + username/email) with IPv6 support
    keyGenerator: (req) => {
      const identifier = req.body?.identifier || 'unknown';
      const ip = getClientIp(req); // IPv6-safe IP extraction
      return `login:${ip}:${identifier}`;
    },
    handler: (req, res) => {
      return res.status(429).json(
        new ApiResponse(
          429,
          null,
          'Too many login attempts. Please try again in 15 minutes.',
          { retry_after: 900 }
        )
      );
    }
  }),

  // PATCH 61: Per-email password reset rate limiting
  passwordReset: rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset requests per email per hour
    // PATCH 61: Composite key (IP + email) with IPv6 support
    keyGenerator: (req) => {
      const email = req.body?.email || 'unknown';
      const ip = getClientIp(req); // IPv6-safe IP extraction
      return `reset:${ip}:${email}`;
    },
    handler: (req, res) => {
      return res.status(429).json(
        new ApiResponse(
          429,
          null,
          'Too many password reset requests. Please try again in 1 hour.',
          { retry_after: 3600 }
        )
      );
    }
  }),

  // Email verification requests
  emailVerification: rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 verification emails per hour
    handler: (req, res) => {
      return res.status(429).json(
        new ApiResponse(
          429,
          null,
          'Too many email verification requests. Please try again in 1 hour.',
          { retry_after: 3600 }
        )
      );
    }
  }),

  // 2FA attempts
  twoFactor: rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 2FA attempts per 15 minutes
    handler: (req, res) => {
      return res.status(429).json(
        new ApiResponse(
          429,
          null,
          'Too many 2FA attempts. Please try again in 15 minutes.',
          { retry_after: 900 }
        )
      );
    }
  })
};

/**
 * API operation-specific rate limiters
 */
export const apiLimiters = {
  // General API requests
  general: rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // 1000 requests per 15 minutes
  }),

  // Create operations (more restrictive)
  create: rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100 // 100 create operations per hour
  }),

  // Search operations
  search: rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200 // 200 search requests per 15 minutes
  }),

  // File upload operations
  upload: rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20 // 20 file uploads per hour
  }),

  // Export operations
  export: rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10 // 10 export operations per hour
  })
};

/**
 * User-specific rate limiter (based on user ID instead of IP)
 */
export const userRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyGenerator: (req) => {
      return req.user?.id || getClientIp(req);
    },
    handler: (req, res) => {
      const retryAfter = Math.ceil(options.windowMs / 1000) || 900;
      return res.status(429).json(
        new ApiResponse(
          429,
          null,
          'Too many requests from this account. Please try again later.',
          { retry_after: retryAfter }
        )
      );
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
};

/**
 * Organisation-specific rate limiter
 */
export const orgRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000,
    max: 500, // Higher limit for organisation-based limiting
    keyGenerator: (req) => {
      return req.user?.organisation_id || getClientIp(req);
    },
    handler: (req, res) => {
      const retryAfter = Math.ceil(options.windowMs / 1000) || 900;
      return res.status(429).json(
        new ApiResponse(
          429,
          null,
          'Organisation request limit exceeded. Please try again later.',
          { retry_after: retryAfter }
        )
      );
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
};

/**
 * Adaptive rate limiter that adjusts based on subscription plan
 */
export const adaptiveRateLimiter = (baseOptions = {}) => {
  return (req, res, next) => {
    let limits = {
      windowMs: 15 * 60 * 1000,
      max: 100
    };

    // Adjust limits based on user's subscription plan
    if (req.user && req.user.organisation && req.user.organisation.subscription_plan) {
      const plan = req.user.organisation.subscription_plan;
      
      // Adjust based on plan tier
      switch (plan.plan_code) {
        case 'BASIC':
          limits.max = 50;
          break;
        case 'PROFESSIONAL':
          limits.max = 200;
          break;
        case 'ENTERPRISE':
          limits.max = 500;
          break;
        default:
          limits.max = 100;
      }
    }

    const limiter = rateLimit({
      ...limits,
      ...baseOptions,
      keyGenerator: (req) => req.user?.organisation_id || getClientIp(req),
      handler: (req, res) => {
        const retryAfter = Math.ceil(limits.windowMs / 1000);
        return res.status(429).json(
          new ApiResponse(
            429,
            null,
            'Request limit exceeded for your subscription plan.',
            { retry_after: retryAfter }
          )
        );
      }
    });

    limiter(req, res, next);
  };
};

// Legacy export for backward compatibility
export default authLimiters.login;

// Export all rate limiters
export {
  rateLimiter as createRateLimiter,
  authLimiters as authRateLimit,
  apiLimiters as apiRateLimit
};
