import { ApiResponse } from '../utils/ApiResponse.js';
import * as organisationRepository from '../repositories/organisationRepository/organisation.repository.js';
import * as userRepository from '../repositories/userRepository/user.repository.js';

/**
 * Organization scope middleware
 * Ensures users can only access resources within their organization
 */
export const organisationScope = (options = {}) => {
  const {
    strict = true,           // If true, fails if no organization found
    allowSuperAdmin = true,  // Allow super admins to bypass scope
    paramName = 'id',        // Parameter name to check for organization access
    checkResource = false    // If true, checks if resource belongs to user's org
  } = options;

  return async (req, res, next) => {
    try {
      console.log(`=== ORGANISATION SCOPE MIDDLEWARE [${req.requestId || 'no-id'}] ===`);
      console.log('req.url:', req.url);
      console.log('req.originalUrl:', req.originalUrl);
      console.log('req.query:', req.query);
      console.log('req.user:', req.user?.username, req.user?.user_type);
      console.log('req.user.organisation_id:', req.user?.organisation_id);
      console.log('req.query.organisation_id:', req.query.organisation_id);

      if (!req.user) {
        console.log('No user found, returning 401');
        return res.status(401).json(
          new ApiResponse(401, null, 'Authentication required')
        );
      }

      // SECURITY: Check permission-based access instead of hardcoded checks
      // PATCH 2: Removed hardcoded role name checks (SuperAdmin/Admin)
      const permissions = req.user.role_id?.permissions || {};

      const hasOrgAccessAll =
        permissions['organisation:access:all'] === true ||
        permissions.client?.read === true ||
        permissions.client?.manage === true;

      const hasOverviewRead = req.user.user_type === 'internal' &&
        (permissions['overview:read'] === true ||
         permissions.overview?.read === true);

      if (allowSuperAdmin && (hasOrgAccessAll || hasOverviewRead)) {
        console.log('User has permission to access all organisations');
        // Accept both 'orgId' and 'organisation_id' as query parameters
        const orgId = req.query.orgId || req.query.organisation_id;
        if (orgId) {
          console.log('Setting organisation filter:', orgId);
          req.organisationFilter = {
            organisation_id: orgId
          };
        }
        return next();
      }

      // Check if user has organization assigned
      // SECURITY FIX: Handle both populated object and ObjectId
      const userOrgId = req.user.organisation_id?._id || req.user.organisation_id;

      if (!userOrgId) {
        if (strict) {
          return res.status(403).json(
            new ApiResponse(403, null, 'No organization assigned to user')
          );
        }
        return next();
      }

      // Verify organization is active
      const organisation = await organisationRepository.findOrganisationById(userOrgId);
      if (!organisation) {
        return res.status(403).json(
          new ApiResponse(403, null, 'Organization not found')
        );
      }

      if (organisation.status !== 'active') {
        return res.status(403).json(
          new ApiResponse(403, null, 'Organization is inactive')
        );
      }

      // Check subscription status
      if (organisation.subscription_status !== 'active' && organisation.subscription_status !== 'trial') {
        return res.status(403).json(
          new ApiResponse(403, null, 'Organization subscription is not active')
        );
      }

      // Attach organization filter to request for use in controllers
      req.organisationFilter = {
        organisation_id: userOrgId
      };
      req.organisation = organisation;

      next();
    } catch (error) {
      console.error('Organization scope error:', error);
      return res.status(500).json(
        new ApiResponse(500, null, 'Organization scope check failed')
      );
    }
  };
};

// Default export
export default organisationScope;