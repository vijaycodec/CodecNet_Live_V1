import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../models/role.model.js';

dotenv.config();

const cleanupPermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB');

    const superadminRole = await Role.findOne({ role_name: 'SuperAdmin' });

    if (superadminRole) {
      const permissions = superadminRole.permissions;

      // Remove old settings permissions, keep only access
      if (permissions.settings) {
        console.log('Before:', permissions.settings);
        permissions.settings = { access: true };
        console.log('After:', permissions.settings);
      }

      // Remove siem:read, keep only siem:access
      if (permissions.siem) {
        console.log('Before siem:', permissions.siem);
        delete permissions.siem.read;
        console.log('After siem:', permissions.siem);
      }

      // Remove risk-matrix:update
      if (permissions['risk-matrix']) {
        console.log('Before risk-matrix:', permissions['risk-matrix']);
        delete permissions['risk-matrix'].update;
        console.log('After risk-matrix:', permissions['risk-matrix']);
      }

      superadminRole.permissions = permissions;
      await superadminRole.save();

      console.log('\n✅ SuperAdmin role cleaned up');
      console.log('\nFinal permissions:');
      Object.keys(permissions).sort().forEach(resource => {
        const actions = Object.keys(permissions[resource]).join(', ');
        console.log(`  - ${resource}: ${actions}`);
      });
    } else {
      console.log('❌ SuperAdmin role not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

cleanupPermissions();
