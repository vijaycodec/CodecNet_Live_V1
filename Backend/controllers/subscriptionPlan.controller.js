import {
  createPlanService,
  getAllPlansService,
  getActivePlansService,
  getPlanByIdService,
  updatePlanService,
  setDefaultPlanService,
  updatePlanFeaturesService,
  updatePlanLimitsService,
  searchPlansService,
  deletePlanService
} from "../services/subscription/subscriptionPlan.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const createPlan = async (req, res) => {
  try {
    const planData = req.body;
    const createdBy = req.user?.id;

    const newPlan = await createPlanService(planData, createdBy);

    res.status(201).json(new ApiResponse(201, newPlan, "Subscription plan created successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Create plan error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAllPlans = async (req, res) => {
  try {
    const plans = await getAllPlansService();

    res.status(200).json(new ApiResponse(200, plans, "Subscription plans retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get all plans error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getActivePlans = async (req, res) => {
  try {
    const plans = await getActivePlansService();

    res.status(200).json(new ApiResponse(200, plans, "Active subscription plans retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get active plans error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await getPlanByIdService(id);

    res.status(200).json(new ApiResponse(200, plan, "Subscription plan retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get plan by ID error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedBy = req.user?.id;

    const updatedPlan = await updatePlanService(id, updateData, updatedBy);

    res.status(200).json(new ApiResponse(200, updatedPlan, "Subscription plan updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update plan error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const setDefaultPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBy = req.user?.id;

    const result = await setDefaultPlanService(id, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Default plan updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Set default plan error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updatePlanFeatures = async (req, res) => {
  try {
    const { id } = req.params;
    const { features } = req.body;
    const updatedBy = req.user?.id;

    const updatedPlan = await updatePlanFeaturesService(id, features, updatedBy);

    res.status(200).json(new ApiResponse(200, updatedPlan, "Plan features updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update plan features error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updatePlanLimits = async (req, res) => {
  try {
    const { id } = req.params;
    const { max_users, max_assets } = req.body;
    const updatedBy = req.user?.id;

    const updatedPlan = await updatePlanLimitsService(id, max_users, max_assets, updatedBy);

    res.status(200).json(new ApiResponse(200, updatedPlan, "Plan resource limits updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update plan limits error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const searchPlans = async (req, res) => {
  try {
    const { q, limit } = req.query;
    const searchTerm = q;
    const searchLimit = parseInt(limit) || 20;

    const plans = await searchPlansService(searchTerm, searchLimit);

    res.status(200).json(new ApiResponse(200, plans, "Plan search completed"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Search plans error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await deletePlanService(id);

    res.status(200).json(new ApiResponse(200, null, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Delete plan error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};