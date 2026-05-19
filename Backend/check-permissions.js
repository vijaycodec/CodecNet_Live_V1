import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from './models/permission.model.js';
import Role from './models/role.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard';

async function checkPermissions() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Check Permission documents
    console.log('📋 Checking Permission Documents:');
    console.log('═'.repeat(60));

    const allPermissions = await Permission.find({}).sort({ resource: 1, action: 1 });

    // Group by resource
    const grouped = {};
    allPermissions.forEach(perm => {
      if (!grouped[perm.resource]) {
        grouped[perm.resource] = [];
      }
      grouped[perm.resource].push(perm.action);
    });

    Object.keys(grouped).sort().forEach(resource => {
      console.log(`   ${resource}: ${grouped[resource].join(', ')}`);
    });

    console.log(`\n   Total permissions: ${allPermissions.length}`);

    // Check for old plural forms
    const pluralPerms = await Permission.find({
      resource: { $in: ['users', 'roles', 'permissions'] }
    });

    if (pluralPerms.length > 0) {
      console.log(`\n   ⚠️  WARNING: Found ${pluralPerms.length} permissions with plural resource names!`);
      pluralPerms.forEach(p => console.log(`      - ${p.resource}:${p.action}`));
    } else {
      console.log('\n   ✅ No plural resource names found');
    }

    // Check SuperAdmin role
    console.log('\n🔐 Checking SuperAdmin Role:');
    console.log('═'.repeat(60));

    const superAdmin = await Role.findOne({ role_name: 'SuperAdmin' });

    if (!superAdmin) {
      console.log('   ❌ SuperAdmin role not found!');
    } else {
      console.log(`   Role: ${superAdmin.role_name}`);
      console.log(`   Description: ${superAdmin.description}`);
      console.log(`   Type: ${superAdmin.role_type}`);

      const permissions = superAdmin.permissions;

      // Check if permissions is "ALL" or object
      if (permissions === 'ALL') {
        console.log('\n   ✅ Permissions: ALL (has all permissions)');
      } else if (typeof permissions === 'object') {
        console.log('\n   📝 Permission Structure:');

        const resources = Object.keys(permissions).sort();
        console.log(`   Total resources: ${resources.length}\n`);

        // Check for old plural forms in role permissions
        const hasPlural = ['users', 'roles', 'permissions'].some(plural => permissions[plural]);
        if (hasPlural) {
          console.log('   ⚠️  WARNING: Found plural resource names in role permissions:');
          if (permissions['users']) console.log('      - users');
          if (permissions['roles']) console.log('      - roles');
          if (permissions['permissions']) console.log('      - permissions');
        }

        // Check for new singular forms
        const hasSingular = ['user', 'role', 'permission'].some(singular => permissions[singular]);
        if (hasSingular) {
          console.log('   ✅ Found singular resource names:');
          if (permissions['user']) console.log('      - user:', JSON.stringify(permissions['user']));
          if (permissions['role']) console.log('      - role:', JSON.stringify(permissions['role']));
          if (permissions['permission']) console.log('      - permission:', JSON.stringify(permissions['permission']));
        }

        // Display all resources
        console.log('\n   All resources in SuperAdmin permissions:');
        resources.forEach(resource => {
          const actions = permissions[resource];
          if (typeof actions === 'object') {
            const actionList = Object.keys(actions).filter(k => actions[k] === true);
            console.log(`      ${resource}: ${actionList.join(', ')}`);
          } else {
            console.log(`      ${resource}: ${actions}`);
          }
        });
      }
    }

    // Check other roles
    console.log('\n📋 Other Roles:');
    console.log('═'.repeat(60));

    const otherRoles = await Role.find({ role_name: { $ne: 'SuperAdmin' } }).sort({ role_name: 1 });

    for (const role of otherRoles) {
      console.log(`\n   ${role.role_name}:`);

      const permissions = role.permissions;
      if (typeof permissions === 'object') {
        const resources = Object.keys(permissions).sort();

        // Check for plural forms
        const hasPlural = ['users', 'roles', 'permissions'].filter(plural => permissions[plural]);
        const hasSingular = ['user', 'role', 'permission'].filter(singular => permissions[singular]);

        if (hasPlural.length > 0) {
          console.log(`      ⚠️  Plural forms: ${hasPlural.join(', ')}`);
        }
        if (hasSingular.length > 0) {
          console.log(`      ✅ Singular forms: ${hasSingular.join(', ')}`);
        }

        console.log(`      Total resources: ${resources.length}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

checkPermissions().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
