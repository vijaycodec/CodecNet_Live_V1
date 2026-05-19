import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organisation from '../models/organisation.model.js';
import User from '../models/user.model.js';
import SubscriptionPlan from '../models/subscriptionPlan.model.js';

dotenv.config();

const checkLimits = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    const orgs = await Organisation.find({}).populate('subscription_plan_id');

    console.log('📊 Organisation User Limits:\n');
    for (const org of orgs) {
      const userCount = await User.countDocuments({ organisation_id: org._id, is_deleted: false });
      const maxUsers = org.subscription_plan_id?.max_users || 'N/A';
      const planName = org.subscription_plan_id?.plan_name || 'N/A';

      const status = userCount >= maxUsers ? '❌ LIMIT REACHED' : '✅ OK';

      console.log(`${org.client_name || org.organisation_name}:`);
      console.log(`  Actual User Count: ${userCount}`);
      console.log(`  Stored Count (current_user_count): ${org.current_user_count}`);
      console.log(`  Max Users: ${maxUsers}`);
      console.log(`  Plan: ${planName}`);
      console.log(`  Status: ${status}`);
      console.log();
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkLimits();
