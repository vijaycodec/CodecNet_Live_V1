import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../models/role.model.js';

dotenv.config();

const addSecurityMetricsPermission = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    const clientRole = await Role.findOne({ role_name: 'Client' });

    if (!clientRole) {
      console.log('❌ Client role not found');
      process.exit(1);
    }

    console.log('📋 Current Client role permissions:', clientRole.permissions);

    // Add security-metrics read permission
    if (!clientRole.permissions['security-metrics']) {
      clientRole.permissions['security-metrics'] = {};
    }
    clientRole.permissions['security-metrics'].read = true;

    // Mark the permissions field as modified (required for nested objects)
    clientRole.markModified('permissions');

    await clientRole.save();

    console.log('\n✅ Added security-metrics:read permission to Client role');
    console.log('📋 Updated permissions:', clientRole.permissions);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

addSecurityMetricsPermission();
