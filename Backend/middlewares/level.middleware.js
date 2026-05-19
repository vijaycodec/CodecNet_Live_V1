// middlewares/level.middleware.js
import User from '../models/user.model.js';

export const checkLevel = (allowedLevels = []) => {
  return async (req, res, next) => {
    const user = await User.findById(req.user.id).populate('role');

    if (user?.role?.name === 'SuperAdmin') {
      return next(); //  Bypass level check
    }

    if (!allowedLevels.includes(user?.level)) {
      return res.status(403).json({
        message: `Access denied: only [${allowedLevels.join(', ')}] levels allowed`
      });
    }

    next();
  };
};
