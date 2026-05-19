import * as organisationRepository from '../repositories/organisationRepository/organisation.repository.js';
import { ApiError } from '../utils/ApiError.js';

// Helper function to validate and normalize phone number format
const formatPhoneNumber = (phone) => {
  if (!phone) return phone;

  // Trim whitespace
  phone = phone.trim();

  // Expected format: +<country code> <mobile number> (e.g., "+91 9876543210")
  const phoneRegex = /^\+[1-9]\d{0,3}\s\d{4,14}$/;

  if (!phoneRegex.test(phone)) {
    throw new ApiError(400, 'Invalid phone number format. Expected: +<country code> <mobile number> (e.g., +91 9876543210)');
  }

  // Return as-is since frontend already sends in correct format
  return phone;
};

export const createOrganisationService = async (orgData) => {
  try {
    // Format phone numbers if provided
    if (orgData.phone_numbers && Array.isArray(orgData.phone_numbers)) {
      orgData.phone_numbers = orgData.phone_numbers.map(phone => formatPhoneNumber(phone));
    }

    return await organisationRepository.createOrganisation(orgData);
  } catch (error) {
    throw new ApiError(500, 'Error creating organisation: ' + error.message);
  }
};

export const getAllOrganisationsService = async (includeDeleted = false) => {
  try {
    return await organisationRepository.findAllOrganisations(includeDeleted);
  } catch (error) {
    throw new ApiError(500, 'Error fetching organisations: ' + error.message);
  }
};

export const getActiveOrganisationsService = async () => {
  try {
    return await organisationRepository.findActiveOrganisations();
  } catch (error) {
    throw new ApiError(500, 'Error fetching active organisations: ' + error.message);
  }
};

export const getOrganisationByIdService = async (id, populateFields, includeCredentials = false) => {
  try {
    const organisation = await organisationRepository.findOrganisationById(id, populateFields, includeCredentials);
    if (!organisation) {
      throw new ApiError(404, 'Organisation not found');
    }
    return organisation;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error fetching organisation: ' + error.message);
  }
};

export const updateOrganisationService = async (id, updateData, userId) => {
  try {
    // Format phone numbers if provided
    if (updateData.phone_numbers && Array.isArray(updateData.phone_numbers)) {
      updateData.phone_numbers = updateData.phone_numbers.map(phone => formatPhoneNumber(phone));
    }

    const organisation = await organisationRepository.updateOrganisationById(id, updateData, userId);
    if (!organisation) {
      throw new ApiError(404, 'Organisation not found');
    }
    return organisation;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error updating organisation: ' + error.message);
  }
};

export const toggleOrganisationStatusService = async (id, userId) => {
  try {
    return await organisationRepository.toggleOrganisationStatus(id, userId);
  } catch (error) {
    throw new ApiError(500, 'Error toggling organisation status: ' + error.message);
  }
};

export const getOrganisationStatisticsService = async (id) => {
  try {
    return await organisationRepository.getOrganisationStatistics(id);
  } catch (error) {
    throw new ApiError(500, 'Error fetching organisation statistics: ' + error.message);
  }
};

export const searchOrganisationsService = async (searchTerm, limit = 20) => {
  try {
    return await organisationRepository.searchOrganisations(searchTerm, limit);
  } catch (error) {
    throw new ApiError(500, 'Error searching organisations: ' + error.message);
  }
};

export const deleteOrganisationService = async (id, deletedBy, reason) => {
  try {
    // Import User model to also delete associated users
    const { default: User } = await import('../models/user.model.js');

    // Find the organisation first to verify it exists
    const organisation = await organisationRepository.findOrganisationById(id);
    if (!organisation) {
      throw new ApiError(404, 'Organisation not found');
    }

    // Delete all users associated with this organisation
    await User.deleteMany({ organisation_id: id });

    // Permanently delete the organisation
    const deletedOrganisation = await organisationRepository.hardDeleteOrganisation(id);

    if (!deletedOrganisation) {
      throw new ApiError(404, 'Organisation not found');
    }

    return {
      success: true,
      message: 'Organisation and all associated users permanently deleted'
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error deleting organisation: ' + error.message);
  }
};

export const deactivateOrganisationService = async (id, updatedBy) => {
  try {
    // Import User model
    const { default: User } = await import('../models/user.model.js');

    // 1. Deactivate the organisation
    const updatedOrganisation = await organisationRepository.updateOrganisationById(id, {
      status: 'inactive'
    }, updatedBy);

    if (!updatedOrganisation) {
      throw new ApiError(404, 'Organisation not found');
    }

    // 2. Find all users who only belong to this organisation
    const users = await User.find({
      organisation_id: id,
      is_deleted: false,
      user_type: 'external' // Only external users are tied to organisations
    });

    let deactivatedUsersCount = 0;

    // 3. Deactivate users who only have this one organisation
    for (const user of users) {
      // Check if user has only one organisation
      const userOrganisationCount = user.organisation_ids?.length || 0;

      // If user has only this organisation (or organisation_ids array has length 1), deactivate them
      if (userOrganisationCount <= 1) {
        user.status = 'inactive';
        user.updated_by = updatedBy;
        await user.save();
        deactivatedUsersCount++;
      }
    }

    return {
      organisation: updatedOrganisation,
      deactivatedUsersCount,
      message: `Organisation deactivated successfully. ${deactivatedUsersCount} user(s) deactivated.`
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error deactivating organisation: ' + error.message);
  }
};

export const activateOrganisationService = async (id, updatedBy) => {
  try {
    // Import User model
    const { default: User } = await import('../models/user.model.js');

    // 1. Activate the organisation
    const updatedOrganisation = await organisationRepository.updateOrganisationById(id, {
      status: 'active'
    }, updatedBy);

    if (!updatedOrganisation) {
      throw new ApiError(404, 'Organisation not found');
    }

    // 2. Find all inactive users who belong to this organisation
    const users = await User.find({
      organisation_id: id,
      is_deleted: false,
      status: 'inactive',
      user_type: 'external' // Only external users are tied to organisations
    });

    let activatedUsersCount = 0;

    // 3. Reactivate users who only have this one organisation
    for (const user of users) {
      // Check if user has only one organisation
      const userOrganisationCount = user.organisation_ids?.length || 0;

      // If user has only this organisation (or organisation_ids array has length 1), reactivate them
      if (userOrganisationCount <= 1) {
        user.status = 'active';
        user.updated_by = updatedBy;
        await user.save();
        activatedUsersCount++;
      }
    }

    return {
      organisation: updatedOrganisation,
      activatedUsersCount,
      message: `Organisation activated successfully. ${activatedUsersCount} user(s) reactivated.`
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error activating organisation: ' + error.message);
  }
};

export const restoreOrganisationService = async (id, restoredBy) => {
  try {
    return await organisationRepository.restoreOrganisation(id, restoredBy);
  } catch (error) {
    throw new ApiError(500, 'Error restoring organisation: ' + error.message);
  }
};