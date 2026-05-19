import SubscriptionPlan from '../../models/subscriptionPlan.model.js';
import mongoose from 'mongoose';

// Basic CRUD operations
export const createSubscriptionPlan = async (planData) => {
  return await SubscriptionPlan.create(planData);
};

export const findSubscriptionPlanById = async (id) => {
  return await SubscriptionPlan.findById(id);
};

export const updateSubscriptionPlanById = async (id, updatedFields, userId = null) => {
  if (userId) {
    updatedFields.updated_by = userId;
  }
  return await SubscriptionPlan.findByIdAndUpdate(id, updatedFields, { 
    new: true,
    runValidators: true 
  });
};

export const deleteSubscriptionPlanById = async (id) => {
  return await SubscriptionPlan.findByIdAndDelete(id);
};

// Query operations
export const findAllSubscriptionPlans = async () => {
  return await SubscriptionPlan.find()
    .sort({ display_order: 1 });
};

export const findActiveSubscriptionPlans = async () => {
  return await SubscriptionPlan.getActivePlans();
};

export const findDefaultSubscriptionPlan = async () => {
  return await SubscriptionPlan.getDefaultPlan();
};

export const findSubscriptionPlanByCode = async (planCode) => {
  return await SubscriptionPlan.findOne({ 
    plan_code: planCode.toUpperCase(),
    is_active: true 
  });
};

export const findSubscriptionPlanByName = async (planName) => {
  return await SubscriptionPlan.findOne({ 
    plan_name: planName,
    is_active: true 
  });
};

// Status management
export const activateSubscriptionPlan = async (id, userId = null) => {
  const updateData = { is_active: true };
  if (userId) {
    updateData.updated_by = userId;
  }
  return await SubscriptionPlan.findByIdAndUpdate(id, updateData, { new: true });
};

export const deactivateSubscriptionPlan = async (id, userId = null) => {
  const updateData = { is_active: false };
  if (userId) {
    updateData.updated_by = userId;
  }
  return await SubscriptionPlan.findByIdAndUpdate(id, updateData, { new: true });
};

export const setDefaultSubscriptionPlan = async (id, userId = null) => {
  // First, remove default flag from all other plans
  await SubscriptionPlan.updateMany(
    { _id: { $ne: id } },
    { is_default: false }
  );
  
  // Then set this plan as default
  const updateData = { is_default: true, is_active: true };
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await SubscriptionPlan.findByIdAndUpdate(id, updateData, { new: true });
};

// Feature management
export const updatePlanFeatures = async (id, features, userId = null) => {
  const updateData = { features };
  if (userId) {
    updateData.updated_by = userId;
  }
  return await SubscriptionPlan.findByIdAndUpdate(id, updateData, { 
    new: true,
    runValidators: true 
  });
};

export const addFeatureToPlan = async (id, featureKey, featureValue, userId = null) => {
  const plan = await SubscriptionPlan.findById(id);
  if (!plan) {
    throw new Error('Subscription plan not found');
  }
  
  if (!plan.features) {
    plan.features = {};
  }
  
  plan.features[featureKey] = featureValue;
  
  if (userId) {
    plan.updated_by = userId;
  }
  
  plan.markModified('features');
  return await plan.save();
};

export const removeFeatureFromPlan = async (id, featureKey, userId = null) => {
  const plan = await SubscriptionPlan.findById(id);
  if (!plan) {
    throw new Error('Subscription plan not found');
  }
  
  if (plan.features && plan.features[featureKey] !== undefined) {
    delete plan.features[featureKey];
    plan.markModified('features');
    
    if (userId) {
      plan.updated_by = userId;
    }
    
    return await plan.save();
  }
  
  return plan;
};

// Resource limits management
export const updateResourceLimits = async (id, maxUsers, maxAssets, userId = null) => {
  const updateData = { 
    max_users: maxUsers,
    max_assets: maxAssets
  };
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await SubscriptionPlan.findByIdAndUpdate(id, updateData, { 
    new: true,
    runValidators: true 
  });
};

// Usage and statistics
export const getPlanUsageCount = async (planId) => {
  const Organisation = mongoose.model('Organisation');
  return await Organisation.countDocuments({
    subscription_plan_id: planId
  });
};

export const findPlansInUse = async () => {
  const Organisation = mongoose.model('Organisation');
  
  const plansInUse = await Organisation.aggregate([
    {
      $group: {
        _id: '$subscription_plan_id',
        organisationCount: { $sum: 1 }
      }
    }
  ]);
  
  const planIds = plansInUse.map(p => p._id).filter(Boolean);
  
  const plans = await SubscriptionPlan.find({
    _id: { $in: planIds }
  });
  
  return plans.map(plan => ({
    ...plan.toObject(),
    organisationCount: plansInUse.find(p => p._id.toString() === plan._id.toString())?.organisationCount || 0
  }));
};

export const getPlanStatistics = async () => {
  const totalPlans = await SubscriptionPlan.countDocuments();
  const activePlans = await SubscriptionPlan.countDocuments({ is_active: true });
  const defaultPlan = await SubscriptionPlan.findOne({ is_default: true });
  
  const Organisation = mongoose.model('Organisation');
  const totalOrganisations = await Organisation.countDocuments();
  
  return {
    totalPlans,
    activePlans,
    inactivePlans: totalPlans - activePlans,
    defaultPlan: defaultPlan ? defaultPlan.plan_name : null,
    totalOrganisations
  };
};

// Search operations
export const searchSubscriptionPlans = async (searchTerm, limit = 20) => {
  const query = {
    $or: [
      { plan_name: { $regex: searchTerm, $options: 'i' } },
      { plan_code: { $regex: searchTerm, $options: 'i' } },
      { plan_description: { $regex: searchTerm, $options: 'i' } }
    ]
  };
  
  return await SubscriptionPlan.find(query)
    .limit(limit)
    .sort({ display_order: 1 });
};

// Validation operations
export const validatePlanLimits = async (planId, userCount, assetCount) => {
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    throw new Error('Subscription plan not found');
  }
  
  return {
    userLimitValid: userCount <= plan.max_users,
    assetLimitValid: assetCount <= plan.max_assets,
    maxUsers: plan.max_users,
    maxAssets: plan.max_assets,
    currentUsers: userCount,
    currentAssets: assetCount
  };
};

export const checkPlanCodeExists = async (planCode, excludePlanId = null) => {
  const query = { plan_code: planCode.toUpperCase() };
  
  if (excludePlanId) {
    query._id = { $ne: excludePlanId };
  }
  
  const plan = await SubscriptionPlan.findOne(query);
  return !!plan;
};

export const checkPlanNameExists = async (planName, excludePlanId = null) => {
  const query = { plan_name: planName };
  
  if (excludePlanId) {
    query._id = { $ne: excludePlanId };
  }
  
  const plan = await SubscriptionPlan.findOne(query);
  return !!plan;
};

// Bulk operations
export const createMultiplePlans = async (plansData) => {
  return await SubscriptionPlan.insertMany(plansData);
};

export const updateDisplayOrder = async (planOrderUpdates) => {
  const bulkOps = planOrderUpdates.map(update => ({
    updateOne: {
      filter: { _id: update.id },
      update: { display_order: update.order }
    }
  }));
  
  return await SubscriptionPlan.bulkWrite(bulkOps);
};

// Trial management
export const updateTrialDays = async (id, trialDays, userId = null) => {
  const updateData = { trial_days: trialDays };
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await SubscriptionPlan.findByIdAndUpdate(id, updateData, { 
    new: true,
    runValidators: true 
  });
};

export const getPlansWithTrials = async () => {
  return await SubscriptionPlan.find({
    trial_days: { $gt: 0 },
    is_active: true
  }).sort({ trial_days: -1 });
};

// Utility functions
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const validatePlanExists = async (id) => {
  const plan = await SubscriptionPlan.findById(id);
  return !!plan;
};

// Export for backward compatibility
export const getSubscriptionPlanById = findSubscriptionPlanById;