import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../models/role.model.js';
import Permission from '../models/permission.model.js';

dotenv.config();

const checkSettingsAccess = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    // Get SuperAdmin role
    const superAdminRole = await Role.findOne({ role_name: 'SuperAdmin' });

    if (!superAdminRole) {
      console.log('❌ SuperAdmin role not found');
      process.exit(1);
    }

    console.log('📋 SuperAdmin Permissions for Settings/Management:\n');

    const settingsRelated = ['settings', 'permissions', 'roles', 'users'];

    settingsRelated.forEach(resource => {
      if (superAdminRole.permissions[resource]) {
        console.log(`✅ ${resource}:`);
        Object.keys(superAdminRole.permissions[resource]).forEach(action => {
          if (superAdminRole.permissions[resource][action]) {
            console.log(`   - ${resource}:${action}`);
          }
        });
      } else {
        console.log(`❌ ${resource}: MISSING`);
      }
    });

    // Check all available permissions in the system
    console.log('\n📊 All Available Permissions in System:\n');
    const allPermissions = await Permission.find({ status: true });

    const byResource = {};
    allPermissions.forEach(perm => {
      if (!byResource[perm.resource]) {
        byResource[perm.resource] = [];
      }
      byResource[perm.resource].push(perm.action);
    });

    Object.keys(byResource).sort().forEach(resource => {
      console.log(`${resource}: ${byResource[resource].join(', ')}`);
    });

    // Check what SuperAdmin is missing
    console.log('\n🔍 Checking for any missing permissions...\n');

    let missingCount = 0;
    allPermissions.forEach(perm => {
      const hasPermission = superAdminRole.permissions[perm.resource]?.[perm.action];
      if (!hasPermission) {
        console.log(`❌ Missing: ${perm.resource}:${perm.action}`);
        missingCount++;
      }
    });

    if (missingCount === 0) {
      console.log('✅ SuperAdmin has ALL permissions!');
    } else {
      console.log(`\n⚠️  SuperAdmin is missing ${missingCount} permission(s)`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkSettingsAccess();
