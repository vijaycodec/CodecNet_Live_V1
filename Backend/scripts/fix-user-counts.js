import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organisation from '../models/organisation.model.js';
import User from '../models/user.model.js';

dotenv.config();

const fixUserCounts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    const orgs = await Organisation.find({});

    console.log('🔧 Fixing user counts for all organisations:\n');

    for (const org of orgs) {
      const actualUserCount = await User.countDocuments({
        organisation_id: org._id,
        is_deleted: false
      });

      console.log(`${org.client_name || org.organisation_name}:`);
      console.log(`  Current stored count: ${org.current_user_count}`);
      console.log(`  Actual user count: ${actualUserCount}`);

      // Update the count
      org.current_user_count = actualUserCount;
      await org.save();

      console.log(`  ✅ Updated to: ${actualUserCount}\n`);
    }

    console.log('✅ All user counts fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixUserCounts();
