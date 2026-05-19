import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/user.model.js';
import Role from '../models/role.model.js';

dotenv.config();

const checkPermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB');

    const superadmin = await User.findOne({ username: 'superadmin' }).populate('role_id');

    if (superadmin) {
      console.log('\n📋 SuperAdmin User:');
      console.log('Username:', superadmin.username);
      console.log('Email:', superadmin.email);
      console.log('Role:', superadmin.role_id.role_name);
      console.log('\n🔐 Role Permissions:');

      const permissions = superadmin.role_id.permissions;
      Object.keys(permissions).sort().forEach(resource => {
        const actions = Object.keys(permissions[resource]).join(', ');
        console.log(`  - ${resource}: ${actions}`);
      });

      if (permissions.settings) {
        console.log('\n✅ Settings permissions found:', permissions.settings);
      } else {
        console.log('\n❌ NO SETTINGS PERMISSIONS FOUND!');
      }
    } else {
      console.log('❌ SuperAdmin user not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkPermissions();
