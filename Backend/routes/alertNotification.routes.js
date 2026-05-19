import express from 'express';
import {
  listEmailLogs,
  sendTestAlertEmail,
  verifySmtp,
  updateOrgCcEmails,
  getOrgCcEmails
} from '../controllers/alertNotification.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { rateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

router.use(authenticateToken);

// Email delivery logs
router.get(
  '/logs',
  rateLimiter({ windowMs: 60000, max: 60 }),
  listEmailLogs
);

// Manual / test trigger
router.post(
  '/test',
  rateLimiter({ windowMs: 60000, max: 10 }),
  sendTestAlertEmail
);

// SMTP health check
router.get(
  '/smtp/verify',
  rateLimiter({ windowMs: 60000, max: 20 }),
  verifySmtp
);

// CC email management for an organisation
router.get(
  '/cc/:organisationId',
  rateLimiter({ windowMs: 60000, max: 60 }),
  getOrgCcEmails
);

router.put(
  '/cc/:organisationId',
  rateLimiter({ windowMs: 60000, max: 30 }),
  updateOrgCcEmails
);

export default router;
