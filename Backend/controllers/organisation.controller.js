import {
  createOrganisationService,
  getAllOrganisationsService,
  getActiveOrganisationsService,
  getOrganisationByIdService,
  updateOrganisationService,
  toggleOrganisationStatusService,
  getOrganisationStatisticsService,
  searchOrganisationsService,
  deleteOrganisationService,
  deactivateOrganisationService,
  activateOrganisationService,
  restoreOrganisationService
} from "../services/organisation.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const createOrganisation = async (req, res) => {
  try {
    const orgData = req.body;
    const createdBy = req.user?.id;

    const newOrganisation = await createOrganisationService(orgData, createdBy);

    res.status(201).json(new ApiResponse(201, newOrganisation, "Organisation created successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Create organisation error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAllOrganisations = async (req, res) => {
  try {
    const { include_deleted, include_inactive } = req.query;
    const includeDeleted = include_deleted === 'true';
    const includeInactive = include_inactive === 'true';

    const organisations = await getAllOrganisationsService(includeDeleted, includeInactive);

    res.status(200).json(new ApiResponse(200, organisations, "Organisations retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get all organisations error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getActiveOrganisations = async (req, res) => {
  try {
    const organisations = await getActiveOrganisationsService();

    res.status(200).json(new ApiResponse(200, organisations, "Active organisations retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get active organisations error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getOrganisationById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeCredentials } = req.query;

    // Only include credentials if explicitly requested
    const includeWazuhCredentials = includeCredentials === 'true';

    const organisation = await getOrganisationByIdService(id, [], includeWazuhCredentials);

    res.status(200).json(new ApiResponse(200, organisation, "Organisation retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get organisation by ID error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateOrganisation = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedBy = req.user?.id;

    const updatedOrganisation = await updateOrganisationService(id, updateData, updatedBy);

    res.status(200).json(new ApiResponse(200, updatedOrganisation, "Organisation updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update organisation error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateOrganisationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const updatedBy = req.user?.id;

    const result = await toggleOrganisationStatusService(id, updatedBy);

    res.status(200).json(new ApiResponse(200, result, `Organisation ${status === 'active' ? 'activated' : 'deactivated'} successfully`));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update organisation status error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscription_plan_id, subscription_status } = req.body;
    const updatedBy = req.user?.id;

    // Update subscription functionality needs implementation
    const result = await updateOrganisationService(id, { subscription_plan_id, subscription_status }, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Subscription updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update subscription error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateWazuhCredentials = async (req, res) => {
  try {
    const { id } = req.params;
    const { wazuh_credentials } = req.body;
    const updatedBy = req.user?.id;

    // Update wazuh credentials functionality needs implementation
    const result = await updateOrganisationService(id, { wazuh_credentials }, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Wazuh credentials updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update Wazuh credentials error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getOrganisationStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    const statistics = await getOrganisationStatisticsService(id);

    res.status(200).json(new ApiResponse(200, statistics, "Organisation statistics retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get organisation statistics error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const searchOrganisations = async (req, res) => {
  try {
    const { q, limit } = req.query;
    const searchTerm = q;
    const searchLimit = parseInt(limit) || 20;

    const organisations = await searchOrganisationsService(searchTerm, searchLimit);

    res.status(200).json(new ApiResponse(200, organisations, "Organisation search completed"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Search organisations error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const deleteOrganisation = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const deletedBy = req.user?.id;

    // Validate password is provided
    if (!password) {
      return res.status(400).json(new ApiResponse(400, null, "Super admin password is required"));
    }

    // Import User model to verify password
    const { default: User } = await import('../models/user.model.js');
    const bcrypt = await import('bcrypt');

    // Get the current user (who is deleting)
    const currentUser = await User.findById(deletedBy).select('+password_hash');

    if (!currentUser) {
      return res.status(404).json(new ApiResponse(404, null, "User not found"));
    }

    // Check if password hash exists
    if (!currentUser.password_hash) {
      console.error('User password hash not found in database');
      return res.status(500).json(new ApiResponse(500, null, "User password not configured properly"));
    }

    // Verify the provided password matches the current user's password
    const isPasswordValid = await bcrypt.default.compare(password, currentUser.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json(new ApiResponse(401, null, "Invalid password"));
    }

    // Proceed with deletion
    const result = await deleteOrganisationService(id, deletedBy, "Deleted by super admin");

    res.status(200).json(new ApiResponse(200, null, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Delete organisation error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const deactivateOrganisation = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBy = req.user?.id;

    const result = await deactivateOrganisationService(id, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Organisation and associated users deactivated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Deactivate organisation error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const activateOrganisation = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBy = req.user?.id;

    const result = await activateOrganisationService(id, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Organisation activated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Activate organisation error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const restoreOrganisation = async (req, res) => {
  try {
    const { id } = req.params;
    const restoredBy = req.user?.id;

    const result = await restoreOrganisationService(id, restoredBy);

    res.status(200).json(new ApiResponse(200, result, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Restore organisation error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getCurrentOrganisation = async (req, res) => {
  try {
    const organisationId = req.user?.organisation_id;

    const organisation = await getOrganisationByIdService(organisationId);

    res.status(200).json(new ApiResponse(200, organisation, "Current organisation retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get current organisation error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};