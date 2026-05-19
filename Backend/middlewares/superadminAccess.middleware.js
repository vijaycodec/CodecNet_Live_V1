import jwt from 'jsonwebtoken';
import Client from '../models/client.model.js';
import User from '../models/user.model.js';

export const verifySuperAdmin = async (req, res, next) => {
  try {
    // 1. Verify Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'Authorization token missing or malformed',
        solution: 'Include: Authorization: Bearer <token>'
      });
    }

    const token = authHeader.split(' ')[1];

    // 2. Decode and Verify Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Find User with Role Populated
    const superadmin = await User.findById(decoded.id)
      .populate({
        path: 'role',
        select: 'name -_id' // Only get role name, exclude _id
      })
      .lean();

    // Debugging logs (remove in production)
    console.log('Decoded Token:', decoded);
    console.log('User Document:', JSON.stringify(superadmin, null, 2));

    // 4. Validate SuperAdmin Status
    const validRoles = ['superadmin', 'superAdmin', 'SuperAdmin'];
    const normalizedDbRole = superadmin?.role?.name?.toLowerCase();
    const normalizedJwtRole = decoded.role?.toLowerCase();

    if (!superadmin || 
        !superadmin.role || 
        !validRoles.map(r => r.toLowerCase()).includes(normalizedDbRole) ||
        normalizedDbRole !== normalizedJwtRole
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only superadmins can access this resource',
        debug: {
          jwtPayload: {
            id: decoded.id,
            role: decoded.role
          },
          databaseRecord: {
            id: superadmin?._id,
            role: superadmin?.role?.name
          },
          validation: {
            expectedRoles: validRoles,
            receivedRole: superadmin?.role?.name
          }
        },
        solution: [
          '1. Ensure user has SuperAdmin role assigned',
          '2. Verify role name matches exactly (case-sensitive)',
          '3. Check token generation includes correct role'
        ]
      });
    }

    // 5. Verify Client Exists
    const client = await Client.findOne({ user: req.params.clientId })
      .populate('user', 'firstName lastName email')
      .select('+wazuhCredentials +indexerCredentials');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
        solution: 'Verify client ID exists in database'
      });
    }

    // 6. Attach to Request Object
    req.superadmin = {
      ...superadmin,
      _id: superadmin._id.toString() // Ensure consistent ID format
    };
    
    req.client = {
      ...client.toObject(),
      // Mask sensitive credentials in request object
      wazuhCredentials: client.wazuhCredentials ? {
        host: client.wazuhCredentials.host,
        username: client.wazuhCredentials.username
      } : null,
      indexerCredentials: client.indexerCredentials ? {
        host: client.indexerCredentials.host,
        username: client.indexerCredentials.username
      } : null
    };

    next();
  } catch (error) {
    console.error('SuperAdmin Verification Error:', error);

    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        solution: 'Reauthenticate to get a new token'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        solution: 'Check token integrity and signing key'
      });
    }

    // Handle database errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format',
        solution: 'Verify all ID parameters are valid MongoDB IDs'
      });
    }

    // Generic error handler
    res.status(500).json({
      success: false,
      message: 'Internal server error during authorization',
      errorDetails: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};