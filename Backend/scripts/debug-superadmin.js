import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../models/role.model.js';
import User from '../models/user.model.js';

dotenv.config();

const debugSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    // Get SuperAdmin role
    const superAdminRole = await Role.findOne({ role_name: 'SuperAdmin' });

    if (!superAdminRole) {
      console.log('❌ SuperAdmin role not found');
      process.exit(1);
    }

    console.log('📋 SuperAdmin Role Details:');
    console.log('  ID:', superAdminRole._id);
    console.log('  Name:', superAdminRole.role_name);
    console.log('  Permissions type:', typeof superAdminRole.permissions);
    console.log('  Permissions value:', superAdminRole.permissions);
    console.log('\n📊 Permissions Object:');
    console.log(JSON.stringify(superAdminRole.permissions, null, 2));

    // Check specific permissions
    console.log('\n🔍 Checking specific permissions:');
    console.log('  client permissions:', superAdminRole.permissions.client);
    console.log('  organisation permissions:', superAdminRole.permissions.organisation);
    console.log('  assets permissions:', superAdminRole.permissions.assets);

    // Find a SuperAdmin user
    const superAdminUser = await User.findOne({ role_id: superAdminRole._id }).select('username email role_id');
    if (superAdminUser) {
      console.log('\n👤 Found SuperAdmin user:');
      console.log('  Username:', superAdminUser.username);
      console.log('  Email:', superAdminUser.email);
    } else {
      console.log('\n⚠️  No SuperAdmin users found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

debugSuperAdmin();
