import User from '../../models/user.model.js';

export const findUserByEmail = async (email) => {
  return User.findOne({ email }).select('+password_hash').populate('role_id');
};

export const getValidLevels = () => {
  return User.schema.path('level').enumValues;
};
