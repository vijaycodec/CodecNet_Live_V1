import Joi from 'joi';

// Custom validation for IP addresses
const ipAddressValidator = (value, helpers) => {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Custom validation for international phone numbers (format: +<country code> <mobile number>)
const phoneValidator = (value, helpers) => {
  // New format: +<country code> <mobile number> (e.g., +1 1234567890)
  const phoneRegex = /^\+[1-9]\d{0,3}\s\d{4,14}$/;
  if (!phoneRegex.test(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Custom validation for organisation/client names
const nameValidator = (value, helpers) => {
  // Allow letters, numbers, spaces, and common business characters
  const nameRegex = /^[a-zA-Z0-9\s\-\.&',()]+$/;
  if (!nameRegex.test(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Custom validation for usernames (alphanumeric, underscore, hyphen)
const usernameValidator = (value, helpers) => {
  const usernameRegex = /^[a-zA-Z0-9_\-]+$/;
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

const createOrganisationSchema = Joi.object({
  // Basic Information
  organisation_name: Joi.string()
    .min(3)
    .max(100)
    .required()
    .custom(nameValidator)
    .trim()
    .messages({
      'string.min': 'Organisation name must be at least 3 characters',
      'string.max': 'Organisation name must not exceed 100 characters',
      'any.required': 'Organisation name is required',
      'any.invalid': 'Organisation name contains invalid characters. Only letters, numbers, spaces, and common business symbols are allowed'
    }),

  client_name: Joi.string()
    .min(3)
    .max(100)
    .required()
    .custom(nameValidator)
    .trim()
    .messages({
      'string.min': 'Client name must be at least 3 characters',
      'string.max': 'Client name must not exceed 100 characters',
      'any.required': 'Client name is required',
      'any.invalid': 'Client name contains invalid characters. Only letters, numbers, spaces, and common business symbols are allowed'
    }),

  industry: Joi.string()
    .valid('Technology', 'Financial Services', 'Healthcare', 'Retail', 'Education', 'Manufacturing', 'Other')
    .required()
    .messages({
      'any.only': 'Industry must be one of: Technology, Financial Services, Healthcare, Retail, Education, Manufacturing, Other',
      'any.required': 'Industry is required'
    }),

  // Contact Information
  emails: Joi.array()
    .items(
      Joi.string()
        .email({ tlds: { allow: false } })
        .max(254)
        .messages({
          'string.email': 'Please provide a valid email address',
          'string.max': 'Email address must not exceed 254 characters'
        })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one email address is required',
      'any.required': 'Email addresses are required'
    }),

  phone_numbers: Joi.array()
    .items(
      Joi.string()
        .custom(phoneValidator)
        .max(20)
        .messages({
          'string.max': 'Phone number must not exceed 20 characters',
          'any.invalid': 'Please provide a valid phone number in format: +<country code> <mobile number> (e.g., +1 1234567890)'
        })
    )
    .default([]),

  // Critical Alert Notification - dynamic CC list (scalable)
  cc_emails: Joi.array()
    .items(
      Joi.string()
        .email({ tlds: { allow: false } })
        .max(254)
        .messages({
          'string.email': 'Please provide a valid CC email address',
          'string.max': 'CC email must not exceed 254 characters'
        })
    )
    .default([]),

  alert_email_notifications_enabled: Joi.boolean().default(true),

  // Subscription Information
  subscription_plan_id: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid subscription plan ID format',
      'any.required': 'Subscription plan is required'
    }),

  initial_assets: Joi.number()
    .integer()
    .min(0)
    .max(10000)
    .default(0)
    .messages({
      'number.min': 'Initial assets cannot be negative',
      'number.max': 'Initial assets cannot exceed 10,000',
      'number.integer': 'Initial assets must be a whole number'
    }),

  // Wazuh Manager Configuration
  wazuh_manager_ip: Joi.string()
    .custom(ipAddressValidator)
    .required()
    .messages({
      'any.required': 'Wazuh Manager IP address is required',
      'any.invalid': 'Please provide a valid IPv4 address for Wazuh Manager'
    }),

  wazuh_manager_port: Joi.number()
    .integer()
    .min(1)
    .max(65535)
    .required()
    .messages({
      'number.min': 'Wazuh Manager port must be between 1 and 65535',
      'number.max': 'Wazuh Manager port must be between 1 and 65535',
      'any.required': 'Wazuh Manager port is required',
      'number.integer': 'Wazuh Manager port must be a whole number'
    }),

  wazuh_manager_username: Joi.string()
    .min(3)
    .max(50)
    .custom(usernameValidator)
    .required()
    .messages({
      'string.min': 'Wazuh Manager username must be at least 3 characters',
      'string.max': 'Wazuh Manager username must not exceed 50 characters',
      'any.required': 'Wazuh Manager username is required',
      'any.invalid': 'Wazuh Manager username can only contain letters, numbers, underscores, and hyphens'
    }),

  wazuh_manager_password: Joi.string()
    .min(8)
    .max(128)
    .custom(passwordValidator)
    .required()
    .messages({
      'string.min': 'Wazuh Manager password must be at least 8 characters',
      'string.max': 'Wazuh Manager password must not exceed 128 characters',
      'any.required': 'Wazuh Manager password is required',
      'any.invalid': 'Wazuh Manager password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),

  // Wazuh Indexer Configuration
  wazuh_indexer_ip: Joi.string()
    .custom(ipAddressValidator)
    .required()
    .messages({
      'any.required': 'Wazuh Indexer IP address is required',
      'any.invalid': 'Please provide a valid IPv4 address for Wazuh Indexer'
    }),

  wazuh_indexer_port: Joi.number()
    .integer()
    .min(1)
    .max(65535)
    .required()
    .messages({
      'number.min': 'Wazuh Indexer port must be between 1 and 65535',
      'number.max': 'Wazuh Indexer port must be between 1 and 65535',
      'any.required': 'Wazuh Indexer port is required',
      'number.integer': 'Wazuh Indexer port must be a whole number'
    }),

  wazuh_indexer_username: Joi.string()
    .min(3)
    .max(50)
    .custom(usernameValidator)
    .required()
    .messages({
      'string.min': 'Wazuh Indexer username must be at least 3 characters',
      'string.max': 'Wazuh Indexer username must not exceed 50 characters',
      'any.required': 'Wazuh Indexer username is required',
      'any.invalid': 'Wazuh Indexer username can only contain letters, numbers, underscores, and hyphens'
    }),

  wazuh_indexer_password: Joi.string()
    .min(8)
    .max(128)
    .custom(passwordValidator)
    .required()
    .messages({
      'string.min': 'Wazuh Indexer password must be at least 8 characters',
      'string.max': 'Wazuh Indexer password must not exceed 128 characters',
      'any.required': 'Wazuh Indexer password is required',
      'any.invalid': 'Wazuh Indexer password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),

  // Wazuh Dashboard Configuration
  wazuh_dashboard_ip: Joi.string()
    .custom(ipAddressValidator)
    .required()
    .messages({
      'any.required': 'Wazuh Dashboard IP address is required',
      'any.invalid': 'Please provide a valid IPv4 address for Wazuh Dashboard'
    }),

  wazuh_dashboard_port: Joi.number()
    .integer()
    .min(1)
    .max(65535)
    .required()
    .messages({
      'number.min': 'Wazuh Dashboard port must be between 1 and 65535',
      'number.max': 'Wazuh Dashboard port must be between 1 and 65535',
      'any.required': 'Wazuh Dashboard port is required',
      'number.integer': 'Wazuh Dashboard port must be a whole number'
    }),

  wazuh_dashboard_username: Joi.string()
    .min(3)
    .max(50)
    .custom(usernameValidator)
    .required()
    .messages({
      'string.min': 'Wazuh Dashboard username must be at least 3 characters',
      'string.max': 'Wazuh Dashboard username must not exceed 50 characters',
      'any.required': 'Wazuh Dashboard username is required',
      'any.invalid': 'Wazuh Dashboard username can only contain letters, numbers, underscores, and hyphens'
    }),

  wazuh_dashboard_password: Joi.string()
    .min(8)
    .max(128)
    .custom(passwordValidator)
    .required()
    .messages({
      'string.min': 'Wazuh Dashboard password must be at least 8 characters',
      'string.max': 'Wazuh Dashboard password must not exceed 128 characters',
      'any.required': 'Wazuh Dashboard password is required',
      'any.invalid': 'Wazuh Dashboard password must contain at least one uppercase letter, one lowercase letter, and one number'
    })
});

const updateOrganisationSchema = Joi.object({
  organisation_name: Joi.string()
    .min(3)
    .max(100)
    .custom(nameValidator)
    .trim()
    .messages({
      'string.min': 'Organisation name must be at least 3 characters',
      'string.max': 'Organisation name must not exceed 100 characters',
      'any.invalid': 'Organisation name contains invalid characters'
    }),

  client_name: Joi.string()
    .min(3)
    .max(100)
    .custom(nameValidator)
    .trim()
    .messages({
      'string.min': 'Client name must be at least 3 characters',
      'string.max': 'Client name must not exceed 100 characters',
      'any.invalid': 'Client name contains invalid characters'
    }),

  industry: Joi.string()
    .valid('Technology', 'Financial Services', 'Healthcare', 'Retail', 'Education', 'Manufacturing', 'Other')
    .messages({
      'any.only': 'Industry must be one of the valid options'
    }),

  emails: Joi.array()
    .items(
      Joi.string()
        .email({ tlds: { allow: false } })
        .max(254)
    )
    .min(1)
    .messages({
      'array.min': 'At least one email address is required'
    }),

  phone_numbers: Joi.array()
    .items(
      Joi.string()
        .custom(phoneValidator)
        .max(20)
    ),

  cc_emails: Joi.array()
    .items(
      Joi.string()
        .email({ tlds: { allow: false } })
        .max(254)
    ),

  alert_email_notifications_enabled: Joi.boolean(),

  initial_assets: Joi.number()
    .integer()
    .min(0)
    .max(10000)
    .messages({
      'number.min': 'Initial assets cannot be negative',
      'number.max': 'Initial assets cannot exceed 10,000'
    }),

  subscription_plan_id: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid subscription plan ID format'
    }),

  // Allow updating Wazuh credentials individually (all optional for updates)
  wazuh_manager_ip: Joi.string().custom(ipAddressValidator).messages({
    'any.invalid': 'Please provide a valid IPv4 address for Wazuh Manager'
  }),
  wazuh_manager_port: Joi.number().integer().min(1).max(65535).messages({
    'number.min': 'Wazuh Manager port must be between 1 and 65535',
    'number.max': 'Wazuh Manager port must be between 1 and 65535'
  }),
  wazuh_manager_username: Joi.string().min(3).max(50).custom(usernameValidator).messages({
    'string.min': 'Wazuh Manager username must be at least 3 characters',
    'string.max': 'Wazuh Manager username must not exceed 50 characters',
    'any.invalid': 'Wazuh Manager username can only contain letters, numbers, underscores, and hyphens'
  }),
  wazuh_manager_password: Joi.string().min(8).max(128).custom(passwordValidator).messages({
    'string.min': 'Wazuh Manager password must be at least 8 characters',
    'string.max': 'Wazuh Manager password must not exceed 128 characters',
    'any.invalid': 'Wazuh Manager password must contain at least one uppercase letter, one lowercase letter, and one number'
  }),

  wazuh_indexer_ip: Joi.string().custom(ipAddressValidator).messages({
    'any.invalid': 'Please provide a valid IPv4 address for Wazuh Indexer'
  }),
  wazuh_indexer_port: Joi.number().integer().min(1).max(65535).messages({
    'number.min': 'Wazuh Indexer port must be between 1 and 65535',
    'number.max': 'Wazuh Indexer port must be between 1 and 65535'
  }),
  wazuh_indexer_username: Joi.string().min(3).max(50).custom(usernameValidator).messages({
    'string.min': 'Wazuh Indexer username must be at least 3 characters',
    'string.max': 'Wazuh Indexer username must not exceed 50 characters',
    'any.invalid': 'Wazuh Indexer username can only contain letters, numbers, underscores, and hyphens'
  }),
  wazuh_indexer_password: Joi.string().min(8).max(128).custom(passwordValidator).messages({
    'string.min': 'Wazuh Indexer password must be at least 8 characters',
    'string.max': 'Wazuh Indexer password must not exceed 128 characters',
    'any.invalid': 'Wazuh Indexer password must contain at least one uppercase letter, one lowercase letter, and one number'
  }),

  wazuh_dashboard_ip: Joi.string().custom(ipAddressValidator).messages({
    'any.invalid': 'Please provide a valid IPv4 address for Wazuh Dashboard'
  }),
  wazuh_dashboard_port: Joi.number().integer().min(1).max(65535).messages({
    'number.min': 'Wazuh Dashboard port must be between 1 and 65535',
    'number.max': 'Wazuh Dashboard port must be between 1 and 65535'
  }),
  wazuh_dashboard_username: Joi.string().min(3).max(50).custom(usernameValidator).messages({
    'string.min': 'Wazuh Dashboard username must be at least 3 characters',
    'string.max': 'Wazuh Dashboard username must not exceed 50 characters',
    'any.invalid': 'Wazuh Dashboard username can only contain letters, numbers, underscores, and hyphens'
  }),
  wazuh_dashboard_password: Joi.string().min(8).max(128).custom(passwordValidator).messages({
    'string.min': 'Wazuh Dashboard password must be at least 8 characters',
    'string.max': 'Wazuh Dashboard password must not exceed 128 characters',
    'any.invalid': 'Wazuh Dashboard password must contain at least one uppercase letter, one lowercase letter, and one number'
  })
});

export { createOrganisationSchema, updateOrganisationSchema };