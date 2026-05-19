import Joi from 'joi';

// Common validation patterns
const objectIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
  'string.pattern.base': 'Invalid ID format'
});

const emailSchema = Joi.string().email().messages({
  'string.email': 'Please provide a valid email address'
});

const usernameSchema = Joi.string().min(3).max(50).pattern(/^[a-zA-Z][a-zA-Z0-9_]{2,49}$/).messages({
  'string.min': 'Username must be at least 3 characters long',
  'string.max': 'Username must not exceed 50 characters',
  'string.pattern.base': 'Username must start with a letter and contain only letters, numbers, and underscores'
});

const passwordSchema = Joi.string().min(8).max(128).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#^()_+\\-=\\[\\]{};:\'",.<>\\/|`~])[A-Za-z\\d@$!%*?&#^()_+\\-=\\[\\]{};:\'",.<>\\/|`~]+$')).messages({
  'string.min': 'Password must be at least 8 characters long',
  'string.max': 'Password must not exceed 128 characters',
  'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
});

const phoneSchema = Joi.string().pattern(/^\+[1-9]\d{0,3}\s\d{4,14}$/).messages({
  'string.pattern.base': 'Please provide a valid phone number in format: +<country code> <mobile number> (e.g., +1 1234567890)'
});

const fullNameSchema = Joi.string().min(2).max(100).pattern(/^[a-zA-Z\s.'-]+$/).messages({
  'string.min': 'Full name must be at least 2 characters long',
  'string.max': 'Full name must not exceed 100 characters',
  'string.pattern.base': 'Full name can only contain letters, spaces, periods, apostrophes, and hyphens'
});

// Create user validation
export const createUserValidator = Joi.object({
  organisation_id: objectIdSchema.when('user_type', {
    is: 'internal',
    then: Joi.optional().allow(null),
    otherwise: Joi.forbidden()
  }),
  organisation_ids: Joi.array()
    .items(objectIdSchema)
    .when('user_type', {
      is: 'external',
      then: Joi.array().items(objectIdSchema).min(1).required(),
      otherwise: Joi.forbidden()
    }),
  username: usernameSchema.required(),
  full_name: fullNameSchema.required(),
  email: emailSchema.required(),
  phone_number: phoneSchema.optional().allow(''),
  password: passwordSchema.required(),
  role_id: objectIdSchema.required(),
  user_type: Joi.string().valid('internal', 'external').default('internal'),
  status: Joi.string().valid('active', 'inactive', 'locked', 'disabled').default('active'),
  timezone: Joi.string().default('Asia/Kolkata'),
  locale: Joi.string().default('en-IN'),
  notification_preferences: Joi.object({
    email: Joi.boolean().default(true),
    sms: Joi.boolean().default(false),
    push: Joi.boolean().default(true)
  }).default(),
  two_factor_enabled: Joi.boolean().default(false),
  must_change_password: Joi.boolean().default(false),
  avatar_url: Joi.string().uri().optional().allow(''),
  other_attributes: Joi.object().default({})
});

// Update user validation
export const updateUserValidator = Joi.object({
  username: usernameSchema.optional(),
  full_name: fullNameSchema.optional(),
  email: emailSchema.optional(),
  phone_number: phoneSchema.optional().allow(''),
  password: passwordSchema.optional().allow(''),
  role_id: objectIdSchema.optional(),
  user_type: Joi.string().valid('internal', 'external').optional(),
  organisation_id: objectIdSchema.optional().allow('', null),
  organisation_ids: Joi.array().items(objectIdSchema).optional(),
  status: Joi.string().valid('active', 'inactive', 'locked', 'disabled').optional(),
  timezone: Joi.string().optional(),
  locale: Joi.string().optional(),
  notification_preferences: Joi.object({
    email: Joi.boolean(),
    sms: Joi.boolean(),
    push: Joi.boolean()
  }).optional(),
  avatar_url: Joi.string().uri().optional().allow(''),
  two_factor_enabled: Joi.boolean().optional(),
  must_change_password: Joi.boolean().optional(),
  other_attributes: Joi.object().optional()
});

// Update profile validation
export const updateProfileValidator = Joi.object({
  full_name: fullNameSchema.optional(),
  phone_number: phoneSchema.optional(),
  timezone: Joi.string().optional(),
  locale: Joi.string().pattern(/^[a-z]{2}-[A-Z]{2}$/).optional(),
  notification_preferences: Joi.object({
    email: Joi.boolean(),
    sms: Joi.boolean(),
    push: Joi.boolean(),
    in_app: Joi.boolean()
  }).optional(),
  avatar_url: Joi.string().uri().optional()
});

// Change password validation
export const changePasswordValidator = Joi.object({
  current_password: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  new_password: passwordSchema.required().messages({
    'any.required': 'New password is required'
  })
});

// Delete user validation
export const deleteUserValidator = Joi.object({
  reason: Joi.string().min(5).max(500).optional().messages({
    'string.min': 'Reason must be at least 5 characters long',
    'string.max': 'Reason must not exceed 500 characters'
  })
});

// User query validator
export const userQueryValidator = Joi.object({
  organisation_id: objectIdSchema.optional(),
  role_id: objectIdSchema.optional(),
  status: Joi.string().valid('active', 'inactive', 'pending').optional(),
  user_type: Joi.string().valid('internal', 'external', 'contractor', 'admin').optional(),
  include_deleted: Joi.boolean().optional(),
  q: Joi.string().min(2).max(100).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  sort_by: Joi.string().valid('createdAt', 'updatedAt', 'username', 'full_name', 'email', 'last_activity_at', 'status').default('createdAt'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc')
});

// User ID parameter validation
export const userIdValidator = Joi.object({
  id: objectIdSchema.required().messages({
    'any.required': 'User ID is required'
  })
});

// Bulk operations validation
export const bulkUserActionValidator = Joi.object({
  user_ids: Joi.array().items(objectIdSchema).min(1).max(50).required().messages({
    'array.min': 'At least one user ID is required',
    'array.max': 'Cannot process more than 50 users at once',
    'any.required': 'User IDs are required'
  }),
  action: Joi.string().valid('activate', 'deactivate', 'delete', 'restore', 'unlock').required().messages({
    'any.required': 'Action is required'
  }),
  reason: Joi.string().min(5).max(500).optional().messages({
    'string.min': 'Reason must be at least 5 characters long',
    'string.max': 'Reason must not exceed 500 characters'
  })
});

// User statistics query validation
export const userStatsQueryValidator = Joi.object({
  organisation_id: objectIdSchema.optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional().messages({
    'date.min': 'End date must be after start date'
  }),
  group_by: Joi.string().valid('day', 'week', 'month', 'role', 'status', 'organisation').optional()
});

export default {
  createUserValidator,
  updateUserValidator,
  updateProfileValidator,
  changePasswordValidator,
  deleteUserValidator,
  userQueryValidator,
  userIdValidator,
  bulkUserActionValidator,
  userStatsQueryValidator
};
