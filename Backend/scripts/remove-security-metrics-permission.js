import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../models/role.model.js';

dotenv.config();

const removeSecurityMetricsPermission = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    const clientRole = await Role.findOne({ role_name: 'Client' });

    if (!clientRole) {
      console.log('❌ Client role not found');
      process.exit(1);
    }

    console.log('📋 Current Client role permissions:', clientRole.permissions);

    // Remove security-metrics permission (no longer needed)
    if (clientRole.permissions['security-metrics']) {
      delete clientRole.permissions['security-metrics'];
      clientRole.markModified('permissions');
      await clientRole.save();
      console.log('\n✅ Removed security-metrics permission from Client role (now using risk-matrix:read instead)');
    } else {
      console.log('\n✅ security-metrics permission not found (already clean)');
    }

    console.log('📋 Updated permissions:', clientRole.permissions);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

removeSecurityMetricsPermission();
