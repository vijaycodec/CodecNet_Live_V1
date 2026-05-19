import Joi from 'joi';

// Common validation patterns
const objectIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
  'string.pattern.base': 'Invalid ID format'
});

// Create subscription plan validator
export const createPlanValidator = Joi.object({
  plan_name: Joi.string().required().messages({
    'any.required': 'Plan name is required'
  }),
  plan_code: Joi.string().required().messages({
    'any.required': 'Plan code is required'
  }),
  description: Joi.string().optional().allow(''),
  price_monthly: Joi.number().min(0).optional(),
  price_yearly: Joi.number().min(0).optional(),
  billing_cycle: Joi.string().valid('monthly', 'yearly', 'one-time').default('monthly'),
  features: Joi.object().optional().default({}),
  max_users: Joi.number().integer().min(1).optional(),
  max_assets: Joi.number().integer().min(1).optional(),
  max_storage_gb: Joi.number().min(0).optional(),
  is_active: Joi.boolean().default(true),
  is_default: Joi.boolean().default(false),
  trial_days: Joi.number().integer().min(0).default(0)
});

// Update subscription plan validator
export const updatePlanValidator = Joi.object({
  plan_name: Joi.string().optional(),
  plan_code: Joi.string().optional(),
  description: Joi.string().optional().allow(''),
  price_monthly: Joi.number().min(0).optional(),
  price_yearly: Joi.number().min(0).optional(),
  billing_cycle: Joi.string().valid('monthly', 'yearly', 'one-time').optional(),
  features: Joi.object().optional(),
  max_users: Joi.number().integer().min(1).optional(),
  max_assets: Joi.number().integer().min(1).optional(),
  max_storage_gb: Joi.number().min(0).optional(),
  is_active: Joi.boolean().optional(),
  is_default: Joi.boolean().optional(),
  trial_days: Joi.number().integer().min(0).optional()
});

// Update plan features validator
export const updatePlanFeaturesValidator = Joi.object({
  features: Joi.object().required().messages({
    'any.required': 'Features object is required'
  })
});

// Update plan limits validator
export const updatePlanLimitsValidator = Joi.object({
  max_users: Joi.number().integer().min(1).optional(),
  max_assets: Joi.number().integer().min(1).optional(),
  max_storage_gb: Joi.number().min(0).optional()
}).min(1).messages({
  'object.min': 'At least one limit field is required'
});

// Query subscription plans validator
export const planQueryValidator = Joi.object({
  is_active: Joi.boolean().optional(),
  billing_cycle: Joi.string().valid('monthly', 'yearly', 'one-time').optional(),
  min_price: Joi.number().min(0).optional(),
  max_price: Joi.number().min(0).optional(),
  q: Joi.string().min(2).max(100).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  sort_by: Joi.string().valid('plan_name', 'price_monthly', 'price_yearly', 'created_at').default('plan_name'),
  sort_order: Joi.string().valid('asc', 'desc').default('asc')
});

// Plan ID parameter validation
export const planIdValidator = Joi.object({
  id: objectIdSchema.required().messages({
    'any.required': 'Plan ID is required'
  })
});

// Plan comparison validator
export const planComparisonValidator = Joi.object({
  plan_ids: Joi.array().items(objectIdSchema).min(2).max(5).required().messages({
    'array.min': 'At least 2 plans are required for comparison',
    'array.max': 'Cannot compare more than 5 plans at once',
    'any.required': 'Plan IDs are required'
  }),
  include_features: Joi.boolean().default(true),
  include_pricing: Joi.boolean().default(true)
});

// Plan usage analytics validator
export const planUsageValidator = Joi.object({
  plan_id: objectIdSchema.optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional().messages({
    'date.min': 'End date must be after start date'
  }),
  group_by: Joi.string().valid('day', 'week', 'month', 'plan').optional(),
  include_trial: Joi.boolean().default(true)
});

// Plan template validator
export const planTemplateValidator = Joi.object({
  template_name: Joi.string().valid('basic', 'professional', 'enterprise').required().messages({
    'any.required': 'Template name is required',
    'any.only': 'Invalid template name. Must be one of: basic, professional, enterprise'
  }),
  customizations: Joi.object({
    plan_name: Joi.string().optional(),
    price_monthly: Joi.number().min(0).optional(),
    price_yearly: Joi.number().min(0).optional(),
    max_users: Joi.number().integer().min(1).optional(),
    max_assets: Joi.number().integer().min(1).optional(),
    trial_days: Joi.number().integer().min(0).optional()
  }).optional()
});

export default {
  createPlanValidator,
  updatePlanValidator,
  updatePlanFeaturesValidator,
  updatePlanLimitsValidator,
  planQueryValidator,
  planIdValidator,
  planComparisonValidator,
  planUsageValidator,
  planTemplateValidator
};
