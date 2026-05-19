import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/user.model.js';
import Role from '../models/role.model.js';

dotenv.config();

const checkUserPermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    const userEmail = 'support@patronustradetech.com';
    console.log(`🔍 Checking user: ${userEmail}\n`);

    const user = await User.findOne({ email: userEmail }).populate('role_id');

    if (!user) {
      console.log('❌ User not found!');
      console.log('\n💡 The user needs to be created first.');
      process.exit(1);
    }

    console.log('✅ User found:');
    console.log(`  • Username: ${user.username}`);
    console.log(`  • Email: ${user.email}`);
    console.log(`  • Full Name: ${user.full_name}`);
    console.log(`  • Status: ${user.status}`);
    console.log(`  • User Type: ${user.user_type}`);
    console.log(`  • Organisation ID: ${user.organisation_id || 'NOT SET'}`);

    if (!user.role_id) {
      console.log('\n❌ User has no role assigned!');
      console.log('\n💡 Assigning Client role to user...');

      const clientRole = await Role.findOne({ role_name: 'Client' });
      if (clientRole) {
        user.role_id = clientRole._id;
        await user.save();
        console.log('✅ Client role assigned successfully!');
      } else {
        console.log('❌ Client role not found in database');
        process.exit(1);
      }
    } else {
      console.log(`\n✅ Role assigned: ${user.role_id.role_name}`);
      console.log('\n📋 Role Permissions:');
      console.log(JSON.stringify(user.role_id.permissions, null, 2));

      if (user.role_id.permissions.assets) {
        console.log('\n✅ User HAS asset permissions:');
        Object.keys(user.role_id.permissions.assets).forEach(action => {
          console.log(`  • assets:${action} = ${user.role_id.permissions.assets[action]}`);
        });
      } else {
        console.log('\n❌ User does NOT have asset permissions');
        console.log('\n💡 To fix: Assign a role with asset permissions or add asset permissions to their current role');
      }
    }

    console.log('\n⚠️  Note: User needs to log out and log back in to see updated permissions');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkUserPermissions();
