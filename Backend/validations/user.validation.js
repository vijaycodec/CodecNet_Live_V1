import Joi from 'joi';

// Custom validation for usernames
const usernameValidator = (value, helpers) => {
  // Must start with a letter and contain only letters, numbers, and underscores
  const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,49}$/;
  if (!usernameRegex.test(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Custom validation for strong passwords
const passwordValidator = (value, helpers) => {
  // Must contain at least one uppercase, one lowercase, one digit
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
  if (!passwordRegex.test(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Custom validation for phone numbers (E.164 format)
const phoneValidator = (value, helpers) => {
  // Remove common formatting characters
  const cleanPhone = value.replace(/[\s()-]/g, '');
  const phoneRegex = /^[+]?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(cleanPhone)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Custom validation for names
const nameValidator = (value, helpers) => {
  // Allow letters, spaces, and common name characters
  const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
  if (!nameRegex.test(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

const createUserSchema = Joi.object({
  // Basic Information
  username: Joi.string()
    .min(3)
    .max(50)
    .required()
    .custom(usernameValidator)
    .trim()
    .messages({
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username must not exceed 50 characters',
      'any.required': 'Username is required',
      'any.invalid': 'Username must start with a letter and contain only letters, numbers, and underscores'
    }),

  full_name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .custom(nameValidator)
    .trim()
    .messages({
      'string.min': 'Full name must be at least 2 characters',
      'string.max': 'Full name must not exceed 100 characters',
      'any.required': 'Full name is required',
      'any.invalid': 'Full name contains invalid characters. Only letters, spaces, hyphens, apostrophes, and periods are allowed'
    }),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .max(254)
    .required()
    .lowercase()
    .trim()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email address must not exceed 254 characters',
      'any.required': 'Email address is required'
    }),

  phone_number: Joi.string()
    .custom(phoneValidator)
    .max(20)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Phone number must not exceed 20 characters',
      'any.invalid': 'Please provide a valid phone number in international format (E.164)'
    }),

  // Authentication
  password: Joi.string()
    .min(8)
    .max(128)
    .custom(passwordValidator)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'Password is required',
      'any.invalid': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),

  // Role and Organization
  role_id: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid role ID format',
      'any.required': 'Role is required'
    }),

  user_type: Joi.string()
    .valid('internal', 'external')
    .default('internal')
    .messages({
      'any.only': 'User type must be either internal or external'
    }),

  // Organization assignment - conditional based on user type
  organisation_id: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .when('user_type', {
      is: 'internal',
      then: Joi.optional(),
      otherwise: Joi.forbidden()
    })
    .messages({
      'string.pattern.base': 'Invalid organisation ID format'
    }),

  organisation_ids: Joi.array()
    .items(
      Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .messages({
          'string.pattern.base': 'Invalid organisation ID format'
        })
    )
    .when('user_type', {
      is: 'external',
      then: Joi.min(1).required(),
      otherwise: Joi.forbidden()
    })
    .messages({
      'array.min': 'External users must be assigned to at least one organisation',
      'any.required': 'Organisation assignment is required for external users'
    }),

  // Account Settings
  status: Joi.string()
    .valid('active', 'inactive', 'locked', 'disabled')
    .default('active')
    .messages({
      'any.only': 'Status must be one of: active, inactive, locked, disabled'
    }),

  // User Preferences
  timezone: Joi.string()
    .default('UTC')
    .messages({
      'string.base': 'Timezone must be a valid string'
    }),

  locale: Joi.string()
    .default('en-IN')
    .messages({
      'string.base': 'Locale must be a valid string'
    }),

  // Optional avatar URL
  avatar_url: Joi.string()
    .uri()
    .optional()
    .allow('')
    .messages({
      'string.uri': 'Avatar URL must be a valid URL'
    }),

  // Notification preferences
  notification_preferences: Joi.object({
    email: Joi.boolean().default(true),
    sms: Joi.boolean().default(false),
    push: Joi.boolean().default(true)
  }).default({
    email: true,
    sms: false,
    push: true
  }),

  // Two-factor authentication
  two_factor_enabled: Joi.boolean()
    .default(false),

  // Password expiry
  must_change_password: Joi.boolean()
    .default(false),

  // Metadata
  other_attributes: Joi.object()
    .default({})
});

const updateUserSchema = Joi.object({
  // Basic Information - all optional for updates
  username: Joi.string()
    .min(3)
    .max(50)
    .custom(usernameValidator)
    .trim()
    .messages({
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username must not exceed 50 characters',
      'any.invalid': 'Username must start with a letter and contain only letters, numbers, and underscores'
    }),

  full_name: Joi.string()
    .min(2)
    .max(100)
    .custom(nameValidator)
    .trim()
    .messages({
      'string.min': 'Full name must be at least 2 characters',
      'string.max': 'Full name must not exceed 100 characters',
      'any.invalid': 'Full name contains invalid characters'
    }),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .max(254)
    .lowercase()
    .trim()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email address must not exceed 254 characters'
    }),

  phone_number: Joi.string()
    .custom(phoneValidator)
    .max(20)
    .allow('')
    .messages({
      'string.max': 'Phone number must not exceed 20 characters',
      'any.invalid': 'Please provide a valid phone number in international format'
    }),

  // Password - optional for updates (empty means don't change)
  password: Joi.string()
    .min(8)
    .max(128)
    .custom(passwordValidator)
    .allow('')
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must not exceed 128 characters',
      'any.invalid': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),

  // Role and type updates
  role_id: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid role ID format'
    }),

  user_type: Joi.string()
    .valid('internal', 'external')
    .messages({
      'any.only': 'User type must be either internal or external'
    }),

  // Organization updates
  organisation_id: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .allow('')
    .messages({
      'string.pattern.base': 'Invalid organisation ID format'
    }),

  organisation_ids: Joi.array()
    .items(
      Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .messages({
          'string.pattern.base': 'Invalid organisation ID format'
        })
    ),

  // Status updates
  status: Joi.string()
    .valid('active', 'inactive', 'locked', 'disabled')
    .messages({
      'any.only': 'Status must be one of: active, inactive, locked, disabled'
    }),

  // Preference updates
  timezone: Joi.string(),
  locale: Joi.string(),

  avatar_url: Joi.string()
    .uri()
    .allow('')
    .messages({
      'string.uri': 'Avatar URL must be a valid URL'
    }),

  notification_preferences: Joi.object({
    email: Joi.boolean(),
    sms: Joi.boolean(),
    push: Joi.boolean()
  }),

  two_factor_enabled: Joi.boolean(),
  must_change_password: Joi.boolean(),

  other_attributes: Joi.object()
});

// Schema for password change
const changePasswordSchema = Joi.object({
  current_password: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),

  new_password: Joi.string()
    .min(8)
    .max(128)
    .custom(passwordValidator)
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters',
      'string.max': 'New password must not exceed 128 characters',
      'any.required': 'New password is required',
      'any.invalid': 'New password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),

  confirm_password: Joi.string()
    .valid(Joi.ref('new_password'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match new password',
      'any.required': 'Password confirmation is required'
    })
});

// Legacy schema for backward compatibility
const userSchema = createUserSchema;

export {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  userSchema
};

export default userSchema;