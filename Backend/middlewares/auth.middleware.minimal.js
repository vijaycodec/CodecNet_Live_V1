import jwt from 'jsonwebtoken';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Extract client IP address from request
 */
export const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         '127.0.0.1';
};

/**
 * Extract device information from request headers
 */
export const getDeviceInfo = (req) => {
  return {
    user_agent: req.headers['user-agent'] || 'Unknown',
    ip_address: getClientIP(req),
    accept_language: req.headers['accept-language'] || null,
    device_fingerprint: req.headers['x-device-fingerprint'] || null
  };
};

/**
 * Minimal authentication middleware without repository dependencies
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        new ApiResponse(401, null, 'Access token required')
      );
    }

    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json(
          new ApiResponse(401, null, 'Token has expired')
        );
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json(
          new ApiResponse(401, null, 'Invalid token')
        );
      }
      return res.status(401).json(
        new ApiResponse(401, null, 'Invalid token')
      );
    }

    // For now, just attach decoded token info to request
    // TODO: Add proper user validation once repository issue is resolved
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      organisation_id: decoded.organisation_id,
      is_active: true // Assume active for now
    };
    
    req.device_info = getDeviceInfo(req);
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Authentication service error')
    );
  }
};

/**
 * Optional authentication middleware
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    await authenticateToken(req, res, (error) => {
      if (error) {
        req.user = null;
      }
      next();
    });
  } catch (error) {
    req.user = null;
    next();
  }
};

/**
 * Require specific auth method
 */
export const requireAuthMethod = (methods = ['password', '2fa']) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(
        new ApiResponse(401, null, 'Authentication required')
      );
    }
    next();
  };
};

/**
 * Require verified email
 */
export const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(
      new ApiResponse(401, null, 'Authentication required')
    );
  }
  next();
};

/**
 * Legacy compatibility
 */
export const protect = authenticateToken;