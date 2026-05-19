import {
  createSubscriptionPlan,
  findSubscriptionPlanById,
  updateSubscriptionPlanById,
  deleteSubscriptionPlanById,
  findAllSubscriptionPlans,
  findActiveSubscriptionPlans,
  findDefaultSubscriptionPlan,
  setDefaultSubscriptionPlan,
  updatePlanFeatures,
  updateResourceLimits,
  getPlanUsageCount,
  checkPlanCodeExists,
  searchSubscriptionPlans,
  validatePlanExists,
  isValidObjectId
} from '../../repositories/subscriptionPlanRepository/subscriptionPlan.repository.js';
import { ApiError } from '../../utils/ApiError.js';

export const createPlanService = async (planData, createdBy = null) => {
  const {
    plan_name,
    plan_description,
    plan_code,
    max_users,
    max_assets,
    features = {},
    trial_days = 0
  } = planData;

  if (!plan_name || !plan_code || !max_users || !max_assets) {
    throw new ApiError(400, 'Plan name, code, max users, and max assets are required');
  }

  // Check if plan code already exists
  const codeExists = await checkPlanCodeExists(plan_code);
  if (codeExists) {
    throw new ApiError(409, 'Plan code already exists');
  }

  const newPlanData = {
    plan_name,
    plan_description,
    plan_code: plan_code.toUpperCase(),
    max_users: parseInt(max_users),
    max_assets: parseInt(max_assets),
    features,
    trial_days: parseInt(trial_days) || 0,
    created_by: createdBy,
    updated_by: createdBy
  };

  const plan = await createSubscriptionPlan(newPlanData);

  return {
    id: plan._id,
    plan_name: plan.plan_name,
    plan_code: plan.plan_code,
    max_users: plan.max_users,
    max_assets: plan.max_assets,
    features: plan.features,
    trial_days: plan.trial_days,
    is_active: plan.is_active,
    created_at: plan.createdAt
  };
};

export const getAllPlansService = async () => {
  const plans = await findAllSubscriptionPlans();
  
  return plans.map(plan => ({
    id: plan._id,
    plan_name: plan.plan_name,
    plan_code: plan.plan_code,
    max_users: plan.max_users,
    max_assets: plan.max_assets,
    features: plan.features,
    is_active: plan.is_active,
    is_default: plan.is_default,
    trial_days: plan.trial_days,
    created_at: plan.createdAt
  }));
};

export const getActivePlansService = async () => {
  const plans = await findActiveSubscriptionPlans();
  
  return plans.map(plan => ({
    id: plan._id,
    plan_name: plan.plan_name,
    plan_code: plan.plan_code,
    max_users: plan.max_users,
    max_assets: plan.max_assets,
    features: plan.features,
    trial_days: plan.trial_days,
    display_order: plan.display_order
  }));
};

export const getPlanByIdService = async (planId) => {
  if (!isValidObjectId(planId)) {
    throw new ApiError(400, 'Invalid plan ID');
  }

  const plan = await findSubscriptionPlanById(planId);
  if (!plan) {
    throw new ApiError(404, 'Subscription plan not found');
  }

  const usageCount = await getPlanUsageCount(planId);

  return {
    id: plan._id,
    plan_name: plan.plan_name,
    plan_description: plan.plan_description,
    plan_code: plan.plan_code,
    max_users: plan.max_users,
    max_assets: plan.max_assets,
    features: plan.features,
    is_active: plan.is_active,
    is_default: plan.is_default,
    trial_days: plan.trial_days,
    display_order: plan.display_order,
    usage_count: usageCount,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt
  };
};

export const updatePlanService = async (planId, updateData, updatedBy = null) => {
  if (!isValidObjectId(planId)) {
    throw new ApiError(400, 'Invalid plan ID');
  }

  const planExists = await validatePlanExists(planId);
  if (!planExists) {
    throw new ApiError(404, 'Subscription plan not found');
  }

  // Check if plan code exists (if being updated)
  if (updateData.plan_code) {
    const codeExists = await checkPlanCodeExists(updateData.plan_code, planId);
    if (codeExists) {
      throw new ApiError(409, 'Plan code already exists');
    }
    updateData.plan_code = updateData.plan_code.toUpperCase();
  }

  const updatedPlan = await updateSubscriptionPlanById(planId, updateData, updatedBy);

  return {
    id: updatedPlan._id,
    plan_name: updatedPlan.plan_name,
    plan_code: updatedPlan.plan_code,
    max_users: updatedPlan.max_users,
    max_assets: updatedPlan.max_assets,
    features: updatedPlan.features,
    is_active: updatedPlan.is_active,
    updated_at: updatedPlan.updatedAt
  };
};

export const setDefaultPlanService = async (planId, updatedBy = null) => {
  if (!isValidObjectId(planId)) {
    throw new ApiError(400, 'Invalid plan ID');
  }

  const plan = await setDefaultSubscriptionPlan(planId, updatedBy);
  if (!plan) {
    throw new ApiError(404, 'Subscription plan not found');
  }

  return {
    message: 'Default plan updated successfully',
    plan: {
      id: plan._id,
      plan_name: plan.plan_name,
      is_default: plan.is_default
    }
  };
};

export const updatePlanFeaturesService = async (planId, features, updatedBy = null) => {
  if (!isValidObjectId(planId)) {
    throw new ApiError(400, 'Invalid plan ID');
  }

  if (!features || typeof features !== 'object') {
    throw new ApiError(400, 'Features must be a valid object');
  }

  const updatedPlan = await updatePlanFeatures(planId, features, updatedBy);
  if (!updatedPlan) {
    throw new ApiError(404, 'Subscription plan not found');
  }

  return {
    id: updatedPlan._id,
    features: updatedPlan.features,
    updated_at: updatedPlan.updatedAt
  };
};

export const updatePlanLimitsService = async (planId, maxUsers, maxAssets, updatedBy = null) => {
  if (!isValidObjectId(planId)) {
    throw new ApiError(400, 'Invalid plan ID');
  }

  if (!maxUsers || !maxAssets || maxUsers <= 0 || maxAssets <= 0) {
    throw new ApiError(400, 'Max users and max assets must be positive numbers');
  }

  const updatedPlan = await updateResourceLimits(planId, maxUsers, maxAssets, updatedBy);
  if (!updatedPlan) {
    throw new ApiError(404, 'Subscription plan not found');
  }

  return {
    id: updatedPlan._id,
    max_users: updatedPlan.max_users,
    max_assets: updatedPlan.max_assets,
    updated_at: updatedPlan.updatedAt
  };
};

export const searchPlansService = async (searchTerm, limit = 20) => {
  if (!searchTerm || searchTerm.trim().length < 2) {
    throw new ApiError(400, 'Search term must be at least 2 characters');
  }

  const plans = await searchSubscriptionPlans(searchTerm.trim(), limit);

  return plans.map(plan => ({
    id: plan._id,
    plan_name: plan.plan_name,
    plan_code: plan.plan_code,
    max_users: plan.max_users,
    max_assets: plan.max_assets,
    is_active: plan.is_active,
    is_default: plan.is_default
  }));
};

export const deletePlanService = async (planId) => {
  if (!isValidObjectId(planId)) {
    throw new ApiError(400, 'Invalid plan ID');
  }

  const usageCount = await getPlanUsageCount(planId);
  if (usageCount > 0) {
    throw new ApiError(400, 'Cannot delete plan that is currently in use');
  }

  const plan = await findSubscriptionPlanById(planId);
  if (!plan) {
    throw new ApiError(404, 'Subscription plan not found');
  }

  if (plan.is_default) {
    throw new ApiError(400, 'Cannot delete the default plan');
  }

  await deleteSubscriptionPlanById(planId);

  return { message: 'Subscription plan deleted successfully' };
};