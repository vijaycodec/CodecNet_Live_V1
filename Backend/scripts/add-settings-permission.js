import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../models/role.model.js';
import Permission from '../models/permission.model.js';

dotenv.config();

const addSettingsPermission = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB');

    // First, create the settings:access permission
    const settingsPermission = new Permission({
      permission_name: 'settings: access',
      permission_code: 'SETTINGS_ACCESS',
      resource: 'settings',
      action: 'access',
      category: 'system',
      description: 'Access settings page',
      status: true
    });
    await settingsPermission.save();
    console.log('✅ Created settings:access permission');

    // Add to SuperAdmin, Admin1, and Manager roles
    const rolesToUpdate = ['SuperAdmin', 'Admin1', 'Manager'];

    for (const roleName of rolesToUpdate) {
      const role = await Role.findOne({ role_name: roleName });
      if (role) {
        if (!role.permissions.settings) {
          role.permissions.settings = {};
        }
        role.permissions.settings.access = true;
        await role.save();
        console.log(`✅ Added settings:access to ${roleName}`);
      }
    }

    console.log('✅ All roles updated');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

addSettingsPermission();
