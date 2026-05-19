import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../models/role.model.js';

dotenv.config();

const migratePermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB');

    const roles = await Role.find({});
    console.log(`📊 Found ${roles.length} roles to update`);

    for (const role of roles) {
      let updated = false;
      const newPermissions = { ...role.permissions };

      // 1. Rename client:* to organisation:*
      if (newPermissions.client) {
        console.log(`  🔄 Migrating client permissions to organisation for role: ${role.role_name}`);
        newPermissions.organisation = { ...newPermissions.client };
        delete newPermissions.client;
        updated = true;
      }

      // 2. Remove siem:read (keep only siem:access)
      if (newPermissions.siem && newPermissions.siem.read) {
        console.log(`  🗑️  Removing siem:read from role: ${role.role_name}`);
        delete newPermissions.siem.read;
        updated = true;
      }

      // 3. Remove risk-matrix:update
      if (newPermissions['risk-matrix'] && newPermissions['risk-matrix'].update) {
        console.log(`  🗑️  Removing risk-matrix:update from role: ${role.role_name}`);
        delete newPermissions['risk-matrix'].update;
        updated = true;
      }

      // 4. Remove settings permissions
      if (newPermissions.settings) {
        console.log(`  🗑️  Removing settings permissions from role: ${role.role_name}`);
        delete newPermissions.settings;
        updated = true;
      }

      // 5. Add missing new permissions for certain roles
      if (role.role_name === 'SuperAdmin' || role.role_name === 'Admin1') {
        // Add missing permissions that were in seed file but not in database
        if (!newPermissions.user?.restore) {
          if (!newPermissions.user) newPermissions.user = {};
          newPermissions.user.restore = true;
          updated = true;
          console.log(`  ➕ Added user:restore to role: ${role.role_name}`);
        }
        if (!newPermissions.user?.analytics) {
          if (!newPermissions.user) newPermissions.user = {};
          newPermissions.user.analytics = true;
          updated = true;
          console.log(`  ➕ Added user:analytics to role: ${role.role_name}`);
        }
        if (!newPermissions.tickets?.analytics) {
          if (!newPermissions.tickets) newPermissions.tickets = {};
          newPermissions.tickets.analytics = true;
          updated = true;
          console.log(`  ➕ Added tickets:analytics to role: ${role.role_name}`);
        }
        if (!newPermissions.agents?.quarantine) {
          if (!newPermissions.agents) newPermissions.agents = {};
          newPermissions.agents.quarantine = true;
          updated = true;
          console.log(`  ➕ Added agents:quarantine to role: ${role.role_name}`);
        }
        if (!newPermissions.plan) {
          newPermissions.plan = {
            read: true,
            create: true,
            update: true,
            delete: true,
            analytics: true
          };
          updated = true;
          console.log(`  ➕ Added plan permissions to role: ${role.role_name}`);
        }
      }

      if (updated) {
        role.permissions = newPermissions;
        await role.save();
        console.log(`  ✅ Updated role: ${role.role_name}`);
      } else {
        console.log(`  ⏭️  No changes needed for role: ${role.role_name}`);
      }
    }

    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migratePermissions();
