import express from 'express';
import {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  updateTicketStatus,
  assignTicket,
  addComment,
  getTicketStats,
  deleteTicket,
  searchTickets,
  getMyTickets,
  updateTicketTime,
  assignTicketToAsset
} from '../controllers/ticket.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizePermissions } from '../middlewares/authorization.middleware.js';
import { organisationScope } from '../middlewares/organisationScope.middleware.js';
import { rateLimiter } from '../middlewares/rateLimit.middleware.js';
import Joi from 'joi';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Add debugging middleware for all ticket routes
router.use('*', (req, res, next) => {
  const requestId = Math.random().toString(36).substring(7);
  req.requestId = requestId;
  console.log(`=== TICKET ROUTES MIDDLEWARE [${requestId}] ===`);
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Original URL:', req.originalUrl);
  console.log('Query:', req.query);
  next();
});

// Validation schemas
const objectIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
  'string.pattern.base': 'Invalid ID format'
});

const createTicketValidator = Joi.object({
  title: Joi.string().min(5).max(200).required().messages({
    'string.min': 'Title must be at least 5 characters long',
    'string.max': 'Title must not exceed 200 characters',
    'any.required': 'Title is required'
  }),
  description: Joi.string().min(10).max(5000).required().messages({
    'string.min': 'Description must be at least 10 characters long',
    'string.max': 'Description must not exceed 5000 characters',
    'any.required': 'Description is required'
  }),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  category: Joi.string().valid('security_incident', 'false_positive', 'system_issue', 'user_request', 'compliance', 'other').required(),
  sub_category: Joi.string().max(100).optional(),
  assignee_id: objectIdSchema.optional(),
  organisation_id: objectIdSchema.optional(), // Allow organisation_id from frontend
  due_date: Joi.date().iso().min('now').optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  severity_level: Joi.string().valid('minor', 'major', 'critical').default('major'),
  severity: Joi.string().valid('minor', 'major', 'critical').default('major'),
  affected_assets: Joi.array().items(objectIdSchema).optional(),
  source_system: Joi.string().max(100).optional(),
  alert_id: Joi.string().max(100).optional(),
  custom_fields: Joi.object().optional()
});

const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    next();
  };
};

/**
 * @route   POST /api/tickets
 * @desc    Create a new ticket
 * @access  Private (All authenticated users can create tickets)
 */
router.post('/',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 1000 }),
  authorizePermissions(['tickets:create']),
  validateRequest(createTicketValidator, 'body'),
  createTicket
);

/**
 * @route   GET /api/tickets
 * @desc    Get all tickets with filtering and pagination
 * @access  Private (Users see tickets from their organisation)
 */
router.get('/',
  authorizePermissions(['tickets:read']),
  organisationScope(),
  getAllTickets
);

/**
 * @route   GET /api/tickets/my
 * @desc    Get current user's assigned tickets
 * @access  Private (All authenticated users)
 */
router.get('/my',
  authorizePermissions(['tickets:read']),
  getMyTickets
);

/**
 * @route   GET /api/tickets/search
 * @desc    Search tickets
 * @access  Private (Users see tickets from their organisation)
 */
router.get('/search',
  authorizePermissions(['tickets:read']),
  organisationScope(),
  searchTickets
);

/**
 * @route   GET /api/tickets/statistics
 * @desc    Get ticket statistics
 * @access  Private (Admin, Manager roles)
 */
router.get('/statistics',
  authorizePermissions(['tickets:analytics']),
  organisationScope(),
  getTicketStats
);

/**
 * @route   GET /api/tickets/:id
 * @desc    Get ticket by ID
 * @access  Private
 */
router.get('/:id',
  authorizePermissions(['tickets:read']),
  getTicketById
);

/**
 * @route   PUT /api/tickets/:id
 * @desc    Update ticket
 * @access  Private
 */
router.put('/:id',
  authorizePermissions(['tickets:update']),
  updateTicket
);

/**
 * @route   PATCH /api/tickets/:id/status
 * @desc    Update ticket status
 * @access  Private
 */
router.patch('/:id/status',
  authorizePermissions(['tickets:update']),
  updateTicketStatus
);

/**
 * @route   POST /api/tickets/:id/assign
 * @desc    Assign ticket to user
 * @access  Private (Admin, Manager roles)
 */
router.post('/:id/assign',
  authorizePermissions(['tickets:update']),
  assignTicket
);

/**
 * @route   POST /api/tickets/:id/comments
 * @desc    Add comment to ticket
 * @access  Private
 */
router.post('/:id/comments',
  authorizePermissions(['tickets:update']),
  addComment
);

/**
 * @route   DELETE /api/tickets/:id
 * @desc    Delete ticket
 * @access  Private (Admin only)
 */
router.delete('/:id',
  authorizePermissions(['tickets:delete']),
  deleteTicket
);

/**
 * @route   PATCH /api/tickets/:id/time
 * @desc    Update ticket time tracking (estimated and actual hours)
 * @access  Private
 */
router.patch('/:id/time',
  updateTicketTime
);

/**
 * @route   PATCH /api/tickets/:id/asset
 * @desc    Assign ticket to asset
 * @access  Private
 */
router.patch('/:id/asset',
  assignTicketToAsset
);

export default router;