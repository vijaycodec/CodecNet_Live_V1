import User from '../models/user.model.js';

export const isSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('role');

    if (!user || !user.role || user.role.name !== 'SuperAdmin') {
      return res.status(403).json({ 
        message: 'Access denied: SuperAdmin only',
        success:false
      });
    }

    next();
  } catch (error) {
    console.error('isSuperAdmin Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
