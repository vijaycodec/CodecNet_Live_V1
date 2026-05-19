import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/permission.model.js';

dotenv.config();

const createAssetPermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    console.log('📋 Creating asset permissions in Permission collection...\n');

    const assetPermissions = [
      { resource: 'assets', action: 'read', scope: 'all', permission_category: 'asset_management', description: 'View asset register', status: true },
      { resource: 'assets', action: 'create', scope: 'all', permission_category: 'asset_management', description: 'Create new assets', status: true },
      { resource: 'assets', action: 'update', scope: 'all', permission_category: 'asset_management', description: 'Update existing assets', status: true },
      { resource: 'assets', action: 'delete', scope: 'all', permission_category: 'asset_management', description: 'Delete assets', status: true },
      { resource: 'assets', action: 'manage', scope: 'all', permission_category: 'asset_management', description: 'Manage and sync assets from Wazuh', status: true }
    ];

    for (const perm of assetPermissions) {
      const existing = await Permission.findOne({ resource: perm.resource, action: perm.action, scope: perm.scope });
      if (!existing) {
        // Generate permission_name following the schema's convention
        const permission_name = `${perm.resource}_${perm.action}_${perm.scope}`.toLowerCase();
        const newPermission = new Permission({ ...perm, permission_name });
        await newPermission.save();
        console.log(`✅ Created assets:${perm.action}:${perm.scope} permission`);
      } else {
        console.log(`ℹ️  assets:${perm.action}:${perm.scope} already exists`);
      }
    }

    console.log('\n✅ Asset permissions created in Permission collection');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

createAssetPermissions();
