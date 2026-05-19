import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/permission.model.js';
import Role from '../models/role.model.js';

dotenv.config();

const addAssetPermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Verify asset permissions exist
    console.log('📋 Verifying asset permissions exist...');

    const assetPermissions = ['read', 'create', 'update', 'delete', 'manage'];
    const existingPermissions = {};

    for (const action of assetPermissions) {
      const permission = await Permission.findOne({
        resource: 'assets',
        action: action
      });

      if (permission) {
        existingPermissions[action] = true;
        console.log(`  ✅ assets:${action} permission exists`);
      } else {
        console.log(`  ⚠️  assets:${action} permission not found`);
      }
    }

    // Step 2: Add permissions to Client role
    console.log('\n📋 Adding asset permissions to Client role...');

    const clientRole = await Role.findOne({ role_name: 'Client' });

    if (!clientRole) {
      console.log('  ❌ Client role not found');
      process.exit(1);
    }

    console.log(`  Current assets permissions:`, clientRole.permissions.assets || 'None');

    // Add asset permissions to Client role
    if (!clientRole.permissions.assets) {
      clientRole.permissions.assets = {};
    }

    // Grant read, create, update, delete permissions to Client role
    // Note: 'manage' permission is for syncing from Wazuh, typically only for admins
    const permissionsToGrant = ['read', 'create', 'update', 'delete'];

    let updated = false;
    for (const action of permissionsToGrant) {
      if (!clientRole.permissions.assets[action]) {
        clientRole.permissions.assets[action] = true;
        console.log(`  ✅ Added assets:${action} permission to Client role`);
        updated = true;
      } else {
        console.log(`  ℹ️  Client role already has assets:${action} permission`);
      }
    }

    if (updated) {
      // Mark the permissions field as modified (required for nested objects)
      clientRole.markModified('permissions');
      await clientRole.save();
      console.log('\n✅ Client role updated successfully!');
    } else {
      console.log('\n✅ Client role already has all required asset permissions');
    }

    console.log('\n📝 Summary:');
    console.log('  • Permissions granted to Client role: read, create, update, delete');
    console.log('  • Permission NOT granted: manage (reserved for admins for Wazuh sync)');
    console.log('\n⚠️  Note: Users need to log out and log back in to see the updated permissions');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

addAssetPermissions();
