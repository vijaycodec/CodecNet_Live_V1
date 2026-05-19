import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organisation from '../models/organisation.model.js';
import User from '../models/user.model.js';

dotenv.config();

const debugUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    const orgs = await Organisation.find({});

    for (const org of orgs) {
      console.log(`\n📋 Organisation: ${org.client_name || org.organisation_name}`);
      console.log(`   ID: ${org._id}`);
      console.log(`   current_user_count: ${org.current_user_count}\n`);

      // Find ALL users (including deleted)
      const allUsers = await User.find({ organisation_id: org._id });
      console.log(`   Total users (including deleted): ${allUsers.length}`);

      if (allUsers.length > 0) {
        console.log('\n   Users:');
        allUsers.forEach(user => {
          console.log(`   - ${user.username} (${user.email})`);
          console.log(`     ID: ${user._id}`);
          console.log(`     is_deleted: ${user.is_deleted}`);
          console.log(`     status: ${user.status}`);
          console.log(`     role_id: ${user.role_id}`);
          console.log('');
        });
      }

      // Count only active users
      const activeCount = await User.countDocuments({
        organisation_id: org._id,
        is_deleted: false
      });
      console.log(`   Active users (is_deleted: false): ${activeCount}`);
      console.log('   ---');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

debugUsers();
