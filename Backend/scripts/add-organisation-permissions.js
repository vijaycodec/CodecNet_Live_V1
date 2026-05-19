import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/permission.model.js';
import Role from '../models/role.model.js';

dotenv.config();

const addOrganisationPermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    console.log('📋 Creating organisation permissions...\n');

    const organisationPermissions = [
      { resource: 'organisation', action: 'read', scope: 'all', permission_category: 'organisation_management', description: 'View organisations', status: true },
      { resource: 'organisation', action: 'create', scope: 'all', permission_category: 'organisation_management', description: 'Create new organisations', status: true },
      { resource: 'organisation', action: 'update', scope: 'all', permission_category: 'organisation_management', description: 'Update organisations', status: true },
      { resource: 'organisation', action: 'delete', scope: 'all', permission_category: 'organisation_management', description: 'Delete organisations', status: true }
    ];

    for (const perm of organisationPermissions) {
      const existing = await Permission.findOne({ resource: perm.resource, action: perm.action, scope: perm.scope });
      if (!existing) {
        const permission_name = `${perm.resource}_${perm.action}_${perm.scope}`.toLowerCase();
        const newPermission = new Permission({ ...perm, permission_name });
        await newPermission.save();
        console.log(`✅ Created organisation:${perm.action}:${perm.scope} permission`);
      } else {
        console.log(`ℹ️  organisation:${perm.action}:${perm.scope} already exists`);
      }
    }

    console.log('\n📋 Granting organisation permissions to SuperAdmin...\n');

    const superAdminRole = await Role.findOne({ role_name: 'SuperAdmin' });
    if (!superAdminRole) {
      console.log('❌ SuperAdmin role not found');
      process.exit(1);
    }

    // Add organisation permissions to SuperAdmin
    if (!superAdminRole.permissions.organisation) {
      superAdminRole.permissions.organisation = {};
    }

    superAdminRole.permissions.organisation.read = true;
    superAdminRole.permissions.organisation.create = true;
    superAdminRole.permissions.organisation.update = true;
    superAdminRole.permissions.organisation.delete = true;

    superAdminRole.markModified('permissions');
    await superAdminRole.save();

    console.log('✅ Organisation permissions granted to SuperAdmin:');
    console.log('  - organisation:read');
    console.log('  - organisation:create');
    console.log('  - organisation:update');
    console.log('  - organisation:delete');

    console.log('\n⚠️  IMPORTANT: Users must log out and log back in to see updated permissions!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

addOrganisationPermissions();
