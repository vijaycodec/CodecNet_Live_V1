import express from 'express';
import {
  getUserPermissions,
  getUserOrganization,
  getWazuhCredentials,
  refreshAccessToken
} from '../controllers/secureAuth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for sensitive endpoints
const sensitiveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const credentialsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Very limited for credentials endpoint
  message: {
    error: 'Too many credential requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/auth/permissions:
 *   get:
 *     summary: Get user permissions securely (server-side)
 *     description: Fetch user permissions from server instead of storing client-side
 *     tags: [Secure Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     permissions:
 *                       type: object
 *                     role:
 *                       type: string
 *                     role_code:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User inactive
 *       404:
 *         description: User not found
 */
router.get('/permissions',
  sensitiveRateLimit,
  authenticate,
  getUserPermissions
);

/**
 * @swagger
 * /api/auth/organization:
 *   get:
 *     summary: Get user organization securely (server-side)
 *     description: Fetch user organization details from server instead of storing client-side
 *     tags: [Secure Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organization retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     organization:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         description:
 *                           type: string
 *                         status:
 *                           type: string
 *                         dashboardUrl:
 *                           type: string
 *                     hasOrganization:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User inactive
 *       404:
 *         description: User or organization not found
 */
router.get('/organization',
  sensitiveRateLimit,
  authenticate,
  getUserOrganization
);

/**
 * @swagger
 * /api/auth/wazuh-credentials:
 *   get:
 *     summary: Get Wazuh credentials securely (HIGHLY SENSITIVE)
 *     description: Fetch Wazuh credentials - should only be used server-side, never expose to client
 *     tags: [Secure Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credentials retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     wazuhCredentials:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: User or organization not found
 */
router.get('/wazuh-credentials',
  credentialsRateLimit,
  authenticate,
  getWazuhCredentials
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using HTTPOnly refresh token
 *     description: Generate new access token from HTTPOnly refresh token cookie
 *     tags: [Secure Auth]
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     expiresIn:
 *                       type: number
 *       401:
 *         description: Unauthorized - Invalid refresh token
 */
router.post('/refresh',
  sensitiveRateLimit,
  refreshAccessToken
);

export default router;