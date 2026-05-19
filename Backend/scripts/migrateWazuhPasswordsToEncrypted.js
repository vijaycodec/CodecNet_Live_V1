/**
 * Migration script to convert plain text Wazuh passwords to encrypted format
 * Run this once to upgrade existing organisations to use encrypted passwords
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { EncryptionUtils } from '../utils/security.util.js';
import Organisation from '../models/organisation.model.js';

// Load environment variables
dotenv.config();

const migrateWazuhPasswords = async () => {
  try {
    console.log('🚀 Starting Wazuh password migration...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all organisations
    const organisations = await Organisation.find({})
      .select('+wazuh_manager_password +wazuh_indexer_password +wazuh_dashboard_password');

    console.log(`📊 Found ${organisations.length} organisations to check`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const org of organisations) {
      try {
        let needsUpdate = false;
        const updateData = {};

        // Check and encrypt wazuh_manager_password
        if (org.wazuh_manager_password) {
          if (typeof org.wazuh_manager_password === 'string') {
            console.log(`🔒 Encrypting wazuh_manager_password for: ${org.organisation_name}`);
            updateData.wazuh_manager_password = EncryptionUtils.encrypt(org.wazuh_manager_password);
            needsUpdate = true;
          } else if (org.wazuh_manager_password.encrypted) {
            console.log(`✓ wazuh_manager_password already encrypted for: ${org.organisation_name}`);
          }
        }

        // Check and encrypt wazuh_indexer_password
        if (org.wazuh_indexer_password) {
          if (typeof org.wazuh_indexer_password === 'string') {
            console.log(`🔒 Encrypting wazuh_indexer_password for: ${org.organisation_name}`);
            updateData.wazuh_indexer_password = EncryptionUtils.encrypt(org.wazuh_indexer_password);
            needsUpdate = true;
          } else if (org.wazuh_indexer_password.encrypted) {
            console.log(`✓ wazuh_indexer_password already encrypted for: ${org.organisation_name}`);
          }
        }

        // Check and encrypt wazuh_dashboard_password
        if (org.wazuh_dashboard_password) {
          if (typeof org.wazuh_dashboard_password === 'string') {
            console.log(`🔒 Encrypting wazuh_dashboard_password for: ${org.organisation_name}`);
            updateData.wazuh_dashboard_password = EncryptionUtils.encrypt(org.wazuh_dashboard_password);
            needsUpdate = true;
          } else if (org.wazuh_dashboard_password.encrypted) {
            console.log(`✓ wazuh_dashboard_password already encrypted for: ${org.organisation_name}`);
          }
        }

        // Update if needed
        if (needsUpdate) {
          await Organisation.findByIdAndUpdate(org._id, updateData);
          console.log(`✅ Migrated passwords for: ${org.organisation_name}`);
          migrated++;
        } else {
          console.log(`⏭️  Skipped (already encrypted): ${org.organisation_name}`);
          skipped++;
        }

      } catch (error) {
        console.error(`❌ Error migrating ${org.organisation_name}:`, error.message);
        errors++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   Total organisations: ${organisations.length}`);
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);

    console.log('\n✨ Migration completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run migration
migrateWazuhPasswords();
