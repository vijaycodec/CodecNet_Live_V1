import express from 'express';
import {
  createPlan,
  getAllPlans,
  getActivePlans,
  getPlanById,
  updatePlan,
  setDefaultPlan,
  updatePlanFeatures,
  updatePlanLimits,
  searchPlans,
  deletePlan
} from '../controllers/subscriptionPlan.controller.js';
import {
  createPlanValidator,
  updatePlanValidator,
  updatePlanFeaturesValidator,
  updatePlanLimitsValidator,
  planQueryValidator,
  planIdValidator,
  planComparisonValidator,
  planUsageValidator,
  planTemplateValidator
} from '../validators/subscriptionPlan.validator.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizePermissions } from '../middlewares/authorization.middleware.js';
import { rateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/subscription-plans
 * @desc    Create a new subscription plan
 * @access  Private (Super Admin only)
 * @permissions plan:create
 */
router.post('/',
  authorizePermissions(['plan:create']),
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }), // 5 plan creations per hour
  validateRequest(createPlanValidator, 'body'),
  createPlan
);

/**
 * @route   GET /api/subscription-plans
 * @desc    Get all subscription plans with filtering
 * @access  Private (Admin, Manager roles)
 * @permissions plan:read
 */
router.get('/',
  authorizePermissions(['plan:read']),
  validateRequest(planQueryValidator, 'query'),
  getAllPlans
);

/**
 * @route   GET /api/subscription-plans/active
 * @desc    Get all active subscription plans
 * @access  Private (All authenticated users can see available plans)
 */
router.get('/active',
  getActivePlans
);

/**
 * @route   GET /api/subscription-plans/search
 * @desc    Search subscription plans
 * @access  Private (Admin, Manager roles)
 * @permissions plan:read
 */
router.get('/search',
  authorizePermissions(['plan:read']),
  validateRequest(planQueryValidator, 'query'),
  searchPlans
);

/**
 * @route   GET /api/subscription-plans/:id
 * @desc    Get subscription plan by ID
 * @access  Private (Admin, Manager roles, or users can see their org's plan)
 * @permissions plan:read
 */
router.get('/:id',
  authorizePermissions(['plan:read']),
  validateRequest(planIdValidator, 'params'),
  getPlanById
);

/**
 * @route   PUT /api/subscription-plans/:id
 * @desc    Update subscription plan
 * @access  Private (Super Admin only)
 * @permissions plan:update
 */
router.put('/:id',
  authorizePermissions(['plan:update']),
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }), // 10 plan updates per hour
  validateRequest(planIdValidator, 'params'),
  validateRequest(updatePlanValidator, 'body'),
  updatePlan
);

/**
 * @route   POST /api/subscription-plans/:id/set-default
 * @desc    Set a plan as default
 * @access  Private (Super Admin only)
 * @permissions plan:update
 */
router.post('/:id/set-default',
  authorizePermissions(['plan:update']),
  validateRequest(planIdValidator, 'params'),
  setDefaultPlan
);

/**
 * @route   PATCH /api/subscription-plans/:id/features
 * @desc    Update plan features
 * @access  Private (Super Admin only)
 * @permissions plan:update
 */
router.patch('/:id/features',
  authorizePermissions(['plan:update']),
  validateRequest(planIdValidator, 'params'),
  validateRequest(updatePlanFeaturesValidator, 'body'),
  updatePlanFeatures
);

/**
 * @route   PATCH /api/subscription-plans/:id/limits
 * @desc    Update plan resource limits
 * @access  Private (Super Admin only)
 * @permissions plan:update
 */
router.patch('/:id/limits',
  authorizePermissions(['plan:update']),
  validateRequest(planIdValidator, 'params'),
  validateRequest(updatePlanLimitsValidator, 'body'),
  updatePlanLimits
);

/**
 * @route   DELETE /api/subscription-plans/:id
 * @desc    Delete subscription plan (only if not in use)
 * @access  Private (Super Admin only)
 * @permissions plan:delete
 */
router.delete('/:id',
  authorizePermissions(['plan:delete']),
  validateRequest(planIdValidator, 'params'),
  deletePlan
);

// Plan comparison and analytics routes

/**
 * @route   POST /api/subscription-plans/compare
 * @desc    Compare multiple subscription plans
 * @access  Private (All authenticated users)
 */
router.post('/compare',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }), // 20 comparisons per 15 minutes
  validateRequest(planComparisonValidator, 'body'),
  async (req, res, next) => {
    try {
      const { plan_ids, include_features = true, include_pricing = true } = req.body;
      
      const plans = [];
      for (const planId of plan_ids) {
        const plan = await getPlanByIdService(planId);
        plans.push(plan);
      }
      
      const comparison = {
        plans: plans.map(plan => ({
          id: plan.id,
          plan_name: plan.plan_name,
          plan_code: plan.plan_code,
          max_users: plan.max_users,
          max_assets: plan.max_assets,
          trial_days: plan.trial_days,
          ...(include_features && { features: plan.features }),
          ...(include_pricing && { 
            price_monthly: plan.price_monthly,
            price_yearly: plan.price_yearly 
          })
        })),
        comparison_date: new Date().toISOString()
      };
      
      res.status(200).json(new ApiResponse(200, comparison, "Plan comparison completed"));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/subscription-plans/analytics/usage
 * @desc    Get plan usage analytics
 * @access  Private (Super Admin only)
 * @permissions plan:analytics
 */
router.get('/analytics/usage',
  authorizePermissions(['plan:analytics']),
  validateRequest(planUsageValidator, 'query'),
  async (req, res, next) => {
    try {
      const { plan_id, start_date, end_date, group_by, include_trial = true } = req.query;
      
      // Implementation would involve aggregating organisation data
      const analytics = {
        total_organisations: 0,
        active_subscriptions: 0,
        trial_subscriptions: 0,
        revenue_data: [],
        usage_trends: [],
        plan_popularity: [],
        query_params: { plan_id, start_date, end_date, group_by, include_trial }
      };
      
      res.status(200).json(new ApiResponse(200, analytics, "Plan usage analytics retrieved"));
    } catch (error) {
      next(error);
    }
  }
);

// Plan templates and presets

/**
 * @route   GET /api/subscription-plans/templates
 * @desc    Get available plan templates
 * @access  Private (Admin roles)
 * @permissions plan:read
 */
router.get('/templates',
  authorizePermissions(['plan:read']),
  (req, res) => {
    const templates = [
      {
        name: 'basic',
        display_name: 'Basic Plan',
        description: 'Essential features for small organizations',
        default_limits: { max_users: 10, max_assets: 100 },
        features: {
          dashboard_access: true,
          user_management: true,
          basic_reporting: true,
          email_support: true
        }
      },
      {
        name: 'professional',
        display_name: 'Professional Plan',
        description: 'Advanced features for growing businesses',
        default_limits: { max_users: 50, max_assets: 500 },
        features: {
          dashboard_access: true,
          user_management: true,
          basic_reporting: true,
          real_time_monitoring: true,
          advanced_analytics: true,
          api_access: true,
          email_support: true,
          phone_support: true
        }
      },
      {
        name: 'enterprise',
        display_name: 'Enterprise Plan',
        description: 'Full-featured solution for large organizations',
        default_limits: { max_users: 500, max_assets: 5000 },
        features: {
          dashboard_access: true,
          user_management: true,
          basic_reporting: true,
          real_time_monitoring: true,
          advanced_analytics: true,
          custom_dashboards: true,
          api_access: true,
          webhook_support: true,
          third_party_integrations: true,
          sso_integration: true,
          advanced_auth: true,
          email_support: true,
          phone_support: true,
          priority_support: true,
          dedicated_manager: true,
          audit_logs: true,
          compliance_reporting: true
        }
      }
    ];
    
    res.status(200).json(new ApiResponse(200, templates, "Plan templates retrieved"));
  }
);

/**
 * @route   POST /api/subscription-plans/from-template
 * @desc    Create plan from template
 * @access  Private (Super Admin only)
 * @permissions plan:create
 */
router.post('/from-template',
  authorizePermissions(['plan:create']),
  validateRequest(planTemplateValidator, 'body'),
  async (req, res, next) => {
    try {
      const { template_name, customizations = {} } = req.body;
      
      // Get template configuration (would be stored in database or config)
      const templates = {
        basic: { max_users: 10, max_assets: 100, /* ... features */ },
        professional: { max_users: 50, max_assets: 500, /* ... features */ },
        enterprise: { max_users: 500, max_assets: 5000, /* ... features */ }
      };
      
      const template = templates[template_name];
      if (!template) {
        return res.status(400).json(new ApiResponse(400, null, "Invalid template name"));
      }
      
      // Merge template with customizations
      const planData = {
        plan_name: `${template_name.charAt(0).toUpperCase() + template_name.slice(1)} Plan`,
        plan_code: template_name.toUpperCase(),
        ...template,
        ...customizations
      };
      
      const newPlan = await createPlanService(planData, req.user.id);
      
      res.status(201).json(new ApiResponse(201, newPlan, "Plan created from template"));
    } catch (error) {
      next(error);
    }
  }
);

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Subscription plan service is healthy',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
router.use((error, req, res, next) => {
  if (error.statusCode >= 400) {
    console.warn(`Subscription plan error: ${error.message}`, {
      user_id: req.user?.id,
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
  
  next(error);
});

export default router;