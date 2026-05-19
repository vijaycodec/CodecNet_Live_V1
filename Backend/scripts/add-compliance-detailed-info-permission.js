import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/permission.model.js';
import Role from '../models/role.model.js';

dotenv.config();

const addComplianceDetailedInfoPermission = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Create the permission
    console.log('📋 Creating compliance-details:access permission...');

    const existingPermission = await Permission.findOne({
      resource: 'compliance-details',
      action: 'access'
    });

    let permission;
    if (existingPermission) {
      console.log('  ℹ️  Permission already exists');
      permission = existingPermission;
    } else {
      permission = new Permission({
        permission_name: 'compliance-details: access',
        resource: 'compliance-details',
        action: 'access',
        permission_category: 'user_management',
        description: 'Access detailed compliance information in external Wazuh dashboard',
        status: true,
      });
      await permission.save();
      console.log('  ✅ Permission created successfully');
    }

    // Step 2: Add permission to roles
    console.log('\n📋 Adding permission to roles...');

    // Roles that should have this permission
    const rolesToUpdate = ['SuperAdmin', 'Admin1', 'Manager', 'Client'];

    for (const roleName of rolesToUpdate) {
      const role = await Role.findOne({ role_name: roleName });

      if (!role) {
        console.log(`  ⚠️  Role "${roleName}" not found - skipping`);
        continue;
      }

      // Check if role already has this permission
      if (role.permissions['compliance-details']?.access) {
        console.log(`  ℹ️  Role "${roleName}" already has the permission`);
        continue;
      }

      // Add the permission
      if (!role.permissions['compliance-details']) {
        role.permissions['compliance-details'] = {};
      }
      role.permissions['compliance-details'].access = true;

      // Mark the permissions field as modified (required for nested objects)
      role.markModified('permissions');

      await role.save();
      console.log(`  ✅ Added permission to role "${roleName}"`);
    }

    console.log('\n✅ All updates completed successfully!');
    console.log('\n📝 Summary:');
    console.log('  • Permission: compliance-details:access');
    console.log('  • Roles updated: SuperAdmin, Admin1, Manager, Client');
    console.log('\n⚠️  Note: Users need to log out and log back in to see the updated permissions');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

addComplianceDetailedInfoPermission();
