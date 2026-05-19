import {
  createRoleService,
  getAllRolesService,
  getActiveRolesService,
  getRoleByIdService,
  updateRoleService,
  updateRolePermissionsService,
  updateRoleStatusService,
  searchRolesService,
  deleteRoleService,
  restoreRoleService,
  cloneRoleService,
  getRoleStatisticsService
} from "../services/role.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const createRole = async (req, res) => {
  try {
    const roleData = req.body;
    const createdBy = req.user?.id;

    const newRole = await createRoleService(roleData, createdBy);

    res.status(201).json(new ApiResponse(201, newRole, "Role created successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Create role error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAllRoles = async (req, res) => {
  try {
    const { include_deleted, include_inactive } = req.query;
    const includeDeleted = include_deleted === 'true';
    const includeInactive = include_inactive === 'true';

    const roles = await getAllRolesService(includeDeleted, includeInactive);

    res.status(200).json(new ApiResponse(200, roles, "Roles retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get all roles error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getActiveRoles = async (req, res) => {
  try {
    const roles = await getActiveRolesService();

    res.status(200).json(new ApiResponse(200, roles, "Active roles retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get active roles error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await getRoleByIdService(id);

    res.status(200).json(new ApiResponse(200, role, "Role retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get role by ID error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedBy = req.user?.id;

    const updatedRole = await updateRoleService(id, updateData, updatedBy);

    res.status(200).json(new ApiResponse(200, updatedRole, "Role updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update role error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateRolePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    const updatedBy = req.user?.id;

    const updatedRole = await updateRolePermissionsService(id, permissions, updatedBy);

    res.status(200).json(new ApiResponse(200, updatedRole, "Role permissions updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update role permissions error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateRoleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBy = req.user?.id;

    const result = await updateRoleStatusService(id, updatedBy);

    res.status(200).json(new ApiResponse(200, result, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update role status error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const searchRoles = async (req, res) => {
  try {
    const { q, limit } = req.query;
    const searchTerm = q;
    const searchLimit = parseInt(limit) || 20;

    const roles = await searchRolesService(searchTerm, searchLimit);

    res.status(200).json(new ApiResponse(200, roles, "Role search completed"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Search roles error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const deletedBy = req.user?.id;

    const result = await deleteRoleService(id, deletedBy, reason);

    res.status(200).json(new ApiResponse(200, null, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Delete role error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const restoreRole = async (req, res) => {
  try {
    const { id } = req.params;
    const restoredBy = req.user?.id;

    const result = await restoreRoleService(id, restoredBy);

    res.status(200).json(new ApiResponse(200, result, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Restore role error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const cloneRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_role_name } = req.body;
    const createdBy = req.user?.id;

    const clonedRole = await cloneRoleService(id, new_role_name, createdBy);

    res.status(201).json(new ApiResponse(201, clonedRole, "Role cloned successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Clone role error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getRoleStatistics = async (req, res) => {
  try {
    const statistics = await getRoleStatisticsService();

    res.status(200).json(new ApiResponse(200, statistics, "Role statistics retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get role statistics error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};



