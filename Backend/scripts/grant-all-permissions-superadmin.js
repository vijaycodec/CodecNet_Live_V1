import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../models/role.model.js';
import Permission from '../models/permission.model.js';

dotenv.config();

const grantAllPermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB');

    // Get all permissions from the database
    const allPermissions = await Permission.find({ status: true });
    console.log(`📊 Found ${allPermissions.length} permissions in database`);

    // Build permissions object with all permissions
    const permissionsObj = {};
    allPermissions.forEach(perm => {
      if (!permissionsObj[perm.resource]) {
        permissionsObj[perm.resource] = {};
      }
      permissionsObj[perm.resource][perm.action] = true;
    });

    console.log('\n🔐 Granting all permissions to SuperAdmin:');
    Object.keys(permissionsObj).sort().forEach(resource => {
      const actions = Object.keys(permissionsObj[resource]).join(', ');
      console.log(`  - ${resource}: ${actions}`);
    });

    // Update SuperAdmin role
    const superadminRole = await Role.findOne({ role_name: 'SuperAdmin' });
    if (superadminRole) {
      superadminRole.permissions = permissionsObj;
      await superadminRole.save();
      console.log('\n✅ SuperAdmin role updated with ALL permissions');
    } else {
      console.log('❌ SuperAdmin role not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

grantAllPermissions();
