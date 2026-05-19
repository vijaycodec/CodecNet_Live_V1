/**
 * MongoDB Migration Script
 * Update Permission Resource Names from Plural to Singular
 *
 * This script updates existing permissions in the database to use singular resource names:
 * - users → user
 * - roles → role
 * - permissions → permission
 *
 * Run this script once on production/staging databases after deploying the updated code.
 *
 * Usage:
 *   node update-permissions-to-singular.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/permission.model.js';
import Role from '../models/role.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard';

// Mapping of plural to singular resource names
const RESOURCE_MAPPING = {
  'users': 'user',
  'roles': 'role',
  'permissions': 'permission'
};

async function updatePermissions() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database');

    // Update Permission documents
    console.log('\n📋 Updating Permission documents...');
    for (const [plural, singular] of Object.entries(RESOURCE_MAPPING)) {
      const result = await Permission.updateMany(
        { resource: plural },
        { $set: { resource: singular } }
      );
      console.log(`   ${plural} → ${singular}: ${result.modifiedCount} documents updated`);
    }

    // Update Role permission structures
    console.log('\n🔐 Updating Role permission structures...');
    const roles = await Role.find({});
    let roleUpdateCount = 0;

    for (const role of roles) {
      let updated = false;
      const permissions = role.permissions || {};

      // Check if role has plural permission keys
      for (const [plural, singular] of Object.entries(RESOURCE_MAPPING)) {
        if (permissions[plural]) {
          // Copy permissions from plural to singular
          permissions[singular] = permissions[plural];
          // Delete the plural key
          delete permissions[plural];
          updated = true;
          console.log(`   ${role.role_name}: ${plural} → ${singular}`);
        }
      }

      // Save if updated
      if (updated) {
        // Use markModified to ensure Mongoose saves the nested object
        role.markModified('permissions');
        await role.save();
        roleUpdateCount++;
        console.log(`   ✅ Saved role: ${role.role_name}`);
      }
    }

    console.log(`\n   Total roles updated: ${roleUpdateCount}`);

    // Summary
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Permission documents updated');
    console.log('   - Role permission structures updated');
    console.log('   - All plural resource names converted to singular');
    console.log('\n⚠️  Important:');
    console.log('   - Clear any application caches');
    console.log('   - Users may need to log out and log back in');
    console.log('   - Test permission checks on all protected routes');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run migration
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   SOC Dashboard - Permission Migration Script             ║');
console.log('║   Plural → Singular Resource Names                        ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log();

updatePermissions()
  .then(() => {
    console.log('\n✨ Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration error:', error);
    process.exit(1);
  });
