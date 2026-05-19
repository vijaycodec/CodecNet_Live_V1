import User from '../models/user.model.js';
import Organisation from '../models/organisation.model.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Get user permissions securely (server-side)
 * This replaces storing permissions in client-side cookies/localStorage
 */
export const getUserPermissions = async (req, res) => {
  try {
    const userId = req.user.id; // From JWT token verification middleware

    const user = await User.findById(userId)
      .populate('role_id')
      .select('role_id status');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user.status !== 'active') {
      throw new ApiError(403, 'User account is inactive');
    }

    const permissions = user.role_id?.permissions || {};

    return res.status(200).json(
      new ApiResponse(200, {
        permissions,
        role: user.role_id?.role_name,
        role_code: user.role_id?.role_code
      }, 'Permissions retrieved successfully')
    );
  } catch (error) {
    console.error('Get permissions error:', error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(
        new ApiResponse(error.statusCode, null, error.message)
      );
    }

    return res.status(500).json(
      new ApiResponse(500, null, 'Internal server error')
    );
  }
};

/**
 * Get user's organization details securely (server-side)
 * This replaces storing organization details in client-side storage
 */
export const getUserOrganization = async (req, res) => {
  try {
    const userId = req.user.id; // From JWT token verification middleware

    const user = await User.findById(userId)
      .select('organisation_id role_id status user_type');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user.status !== 'active') {
      throw new ApiError(403, 'User account is inactive');
    }

    // For users without organization_id, they might not have organization access
    if (!user.organisation_id) {
      return res.status(200).json(
        new ApiResponse(200, {
          organization: null,
          hasOrganization: false
        }, 'User has no organization assigned')
      );
    }

    const organization = await Organisation.findById(user.organisation_id)
      .select('organisation_name client_name industry status wazuh_dashboard_ip wazuh_dashboard_port');

    if (!organization) {
      throw new ApiError(404, 'Organization not found');
    }

    // Return safe organization data (exclude sensitive credentials)
    const safeOrgData = {
      id: organization._id,
      name: organization.client_name || organization.organisation_name,
      description: organization.organisation_name !== organization.client_name
        ? organization.organisation_name
        : organization.industry,
      status: organization.status,
      hasOrganization: true,
      // Only include dashboard URL, not credentials
      dashboardUrl: organization.wazuh_dashboard_ip && organization.wazuh_dashboard_port
        ? `https://${organization.wazuh_dashboard_ip}:${organization.wazuh_dashboard_port}`
        : null
    };

    return res.status(200).json(
      new ApiResponse(200, {
        organization: safeOrgData,
        hasOrganization: true
      }, 'Organization retrieved successfully')
    );
  } catch (error) {
    console.error('Get organization error:', error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(
        new ApiResponse(error.statusCode, null, error.message)
      );
    }

    return res.status(500).json(
      new ApiResponse(500, null, 'Internal server error')
    );
  }
};

/**
 * Get Wazuh credentials securely (server-side only)
 * These should NEVER be sent to client-side
 */
/**
 * SECURITY: REMOVED - This endpoint should NEVER exist
 * Wazuh credentials should NEVER be exposed to client-side
 * Backend should use credentials internally and return only the data users need
 *
 * If you need Wazuh data, create specific endpoints that:
 * 1. Use credentials server-side only
 * 2. Return only the specific data needed (alerts, agents, etc.)
 * 3. Never expose infrastructure details (IPs, ports, credentials)
 */
export const getWazuhCredentials = async (req, res) => {
  // SECURITY: This endpoint is disabled for security reasons
  return res.status(410).json(
    new ApiResponse(410, null, 'This endpoint has been removed for security reasons. Wazuh credentials are not exposed to clients.')
  );
};

/**
 * Refresh access token using HTTPOnly refresh token
 */
export const refreshAccessToken = async (req, res) => {
  try {
    // Refresh token should come from HTTPOnly cookie
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new ApiError(401, 'Refresh token not provided');
    }

    // Validate refresh token and generate new access token
    // Implementation depends on your refresh token strategy

    return res.status(200).json(
      new ApiResponse(200, {
        accessToken: newAccessToken,
        expiresIn: 3600 // 1 hour
      }, 'Token refreshed successfully')
    );
  } catch (error) {
    console.error('Refresh token error:', error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(
        new ApiResponse(error.statusCode, null, error.message)
      );
    }

    return res.status(500).json(
      new ApiResponse(500, null, 'Internal server error')
    );
  }
};