import * as roleRepository from '../repositories/roleRepository/role.repository.js';
import { ApiError } from '../utils/ApiError.js';

export const createRoleService = async (roleData) => {
  try {
    return await roleRepository.createRole(roleData);
  } catch (error) {
    throw new ApiError(500, 'Error creating role: ' + error.message);
  }
};

export const getAllRolesService = async (organisationId, includeDeleted = false) => {
  try {
    return await roleRepository.findAllRoles(organisationId, includeDeleted);
  } catch (error) {
    throw new ApiError(500, 'Error fetching roles: ' + error.message);
  }
};

export const getActiveRolesService = async (organisationId) => {
  try {
    return await roleRepository.findActiveRoles(organisationId);
  } catch (error) {
    throw new ApiError(500, 'Error fetching active roles: ' + error.message);
  }
};

export const getRoleByIdService = async (id, populateFields) => {
  try {
    const role = await roleRepository.findRoleById(id, populateFields);
    if (!role) {
      throw new ApiError(404, 'Role not found');
    }
    return role;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error fetching role: ' + error.message);
  }
};

export const updateRoleService = async (id, updateData, userId) => {
  try {
    const role = await roleRepository.updateRoleById(id, updateData, userId);
    if (!role) {
      throw new ApiError(404, 'Role not found');
    }
    return role;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error updating role: ' + error.message);
  }
};

export const updateRolePermissionsService = async (id, permissions, userId) => {
  try {
    return await roleRepository.updateRolePermissions(id, permissions, userId);
  } catch (error) {
    throw new ApiError(500, 'Error updating role permissions: ' + error.message);
  }
};

export const updateRoleStatusService = async (id, status, userId) => {
  try {
    return await roleRepository.updateRoleStatus(id, status, userId);
  } catch (error) {
    throw new ApiError(500, 'Error updating role status: ' + error.message);
  }
};

export const searchRolesService = async (searchTerm, organisationId, limit = 20) => {
  try {
    return await roleRepository.searchRoles(searchTerm, organisationId, limit);
  } catch (error) {
    throw new ApiError(500, 'Error searching roles: ' + error.message);
  }
};

export const deleteRoleService = async (id, deletedBy, reason) => {
  try {
    return await roleRepository.softDeleteRole(id, deletedBy, reason);
  } catch (error) {
    throw new ApiError(500, 'Error deleting role: ' + error.message);
  }
};

export const restoreRoleService = async (id, restoredBy) => {
  try {
    return await roleRepository.restoreRole(id, restoredBy);
  } catch (error) {
    throw new ApiError(500, 'Error restoring role: ' + error.message);
  }
};

export const cloneRoleService = async (id, newRoleName, userId) => {
  try {
    return await roleRepository.cloneRole(id, newRoleName, userId);
  } catch (error) {
    throw new ApiError(500, 'Error cloning role: ' + error.message);
  }
};

export const getRoleStatisticsService = async (organisationId) => {
  try {
    return await roleRepository.getRoleStatistics(organisationId);
  } catch (error) {
    throw new ApiError(500, 'Error fetching role statistics: ' + error.message);
  }
};