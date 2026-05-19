import express from 'express';
import {
  getAllOrganisations,
  getActiveOrganisations,
  getOrganisationById,
  createOrganisation,
  updateOrganisation,
  deleteOrganisation,
  deactivateOrganisation,
  activateOrganisation,
  getOrganisationStatistics
} from '../controllers/organisation.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizePermissions } from '../middlewares/authorization.middleware.js'; // PATCH 34: Add authorization
import { organisationScope } from '../middlewares/organisationScope.middleware.js';
import { rateLimiter } from '../middlewares/rateLimit.middleware.js';
import { validateRequest, sanitizeInput } from '../middlewares/validation.middleware.js';
import { createOrganisationSchema, updateOrganisationSchema } from '../validations/organisation.validation.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// PATCH 34-35: Add authorization middleware to all routes

// Get all organisations
router.get('/',
  rateLimiter({ windowMs: 60000, max: 100 }),
  authorizePermissions(['organisation:read']), // PATCH 34
  getAllOrganisations
);

// Get active organisations
router.get('/active',
  rateLimiter({ windowMs: 60000, max: 100 }),
  authorizePermissions(['organisation:read']), // PATCH 34
  getActiveOrganisations
);

// Get organisation by ID
router.get('/:id',
  organisationScope({ requireOwnership: true }),
  authorizePermissions(['organisation:read']), // PATCH 34
  getOrganisationById
);

// Create new organisation
router.post('/',
  rateLimiter({ windowMs: 60000, max: 10 }),
  authorizePermissions(['organisation:create']), // PATCH 34
  sanitizeInput('body'),
  validateRequest(createOrganisationSchema, 'body'),
  createOrganisation
);

// Update organisation
router.put('/:id',
  organisationScope({ requireOwnership: true }),
  rateLimiter({ windowMs: 60000, max: 20 }),
  authorizePermissions(['organisation:update']), // PATCH 34
  sanitizeInput('body'),
  validateRequest(updateOrganisationSchema, 'body'),
  updateOrganisation
);

// Delete organisation
router.delete('/:id',
  organisationScope({ requireOwnership: true }),
  rateLimiter({ windowMs: 60000, max: 5 }),
  authorizePermissions(['organisation:delete']), // PATCH 34
  deleteOrganisation
);

// Deactivate organisation (and associated users with single organisation)
router.post('/:id/deactivate',
  organisationScope({ requireOwnership: true }),
  rateLimiter({ windowMs: 60000, max: 10 }),
  authorizePermissions(['organisation:update']),
  deactivateOrganisation
);

// Activate organisation
router.post('/:id/activate',
  organisationScope({ requireOwnership: true }),
  rateLimiter({ windowMs: 60000, max: 10 }),
  authorizePermissions(['organisation:update']),
  activateOrganisation
);

// Get organisation statistics
router.get('/:id/statistics',
  organisationScope({ requireOwnership: true }),
  authorizePermissions(['organisation:read']), // PATCH 34
  getOrganisationStatistics
);

export default router;