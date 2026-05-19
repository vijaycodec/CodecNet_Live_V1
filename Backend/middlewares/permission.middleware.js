// middlewares/permission.middleware.js
import User from '../models/user.model.js';

const hasPermission = (permissionName) => async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('role_id');

    if (!user || !user.role_id) {
      return res.status(403).json({ success: false, message: 'Role not found' });
    }

    const permissions = user.role_id.permissions;

    console.log("Logged-in user:", user.email);
    console.log("Role:", user.role_id.role_name);
    console.log("Checking permission:", permissionName);

    // SECURITY: Check for wildcard permissions instead of hardcoded role name
    // If user has ALL permissions (*:*), allow all access
    if (permissions === 'ALL' || (permissions['*'] && permissions['*']['*'] === true)) {
      console.log("User has wildcard permissions - access granted");
      return next();
    }

    // Parse permission name (e.g., "client:read")
    const [resource, action] = permissionName.split(':');

    // Check for specific permission
    if (permissions[resource] && permissions[resource][action] === true) {
      return next();
    }

    // Check for wildcard resource permissions (resource:*)
    if (permissions[resource] && permissions[resource]['*'] === true) {
      return next();
    }

    // Check for wildcard action permissions (*:action)
    if (permissions['*'] && permissions['*'][action] === true) {
      return next();
    }

    return res.status(403).json({ success: false, message: 'Permission denied' });
  } catch (err) {
    console.error("Permission middleware error:", err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default hasPermission;
