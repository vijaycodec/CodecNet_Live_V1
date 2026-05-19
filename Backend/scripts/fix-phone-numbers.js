import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/user.model.js';
import Organisation from '../models/organisation.model.js';

dotenv.config();

const formatPhoneNumber = (phone) => {
  if (!phone) return phone;

  // Remove all spaces first
  let cleaned = phone.replace(/\s+/g, '');

  // If doesn't start with +, invalid
  if (!cleaned.startsWith('+')) {
    console.log(`  ⚠️  Invalid phone (no +): ${phone}`);
    return null;
  }

  // Extract country code (1-3 digits) and number
  // Try to match common country codes: +1, +91, +44, etc.
  let match = cleaned.match(/^\+([1-9]\d{0,2})(\d{7,14})$/);

  if (!match) {
    console.log(`  ⚠️  Invalid phone format: ${phone}`);
    return null;
  }

  const [, countryCode, number] = match;
  return `+${countryCode} ${number}`;
};

const fixPhoneNumbers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    // Fix User phone numbers
    console.log('🔧 Fixing User phone numbers...');
    const users = await User.find({ phone_number: { $exists: true, $ne: null, $ne: '' } });
    console.log(`📊 Found ${users.length} users with phone numbers\n`);

    let userFixed = 0;
    let userFailed = 0;

    for (const user of users) {
      const originalPhone = user.phone_number;
      const fixedPhone = formatPhoneNumber(originalPhone);

      if (fixedPhone && fixedPhone !== originalPhone) {
        console.log(`  👤 ${user.username}: "${originalPhone}" → "${fixedPhone}"`);
        user.phone_number = fixedPhone;
        await user.save();
        userFixed++;
      } else if (!fixedPhone) {
        console.log(`  ❌ ${user.username}: Could not fix "${originalPhone}"`);
        userFailed++;
      } else {
        console.log(`  ✓ ${user.username}: Already correct "${originalPhone}"`);
      }
    }

    console.log(`\n📈 Users: ${userFixed} fixed, ${userFailed} failed\n`);

    // Fix Organisation phone numbers
    console.log('🔧 Fixing Organisation phone numbers...');
    const orgs = await Organisation.find({
      phone_numbers: { $exists: true, $ne: null }
    });
    console.log(`📊 Found ${orgs.length} organisations with phone numbers\n`);

    let orgFixed = 0;
    let orgPhoneFixed = 0;

    for (const org of orgs) {
      if (!org.phone_numbers || org.phone_numbers.length === 0) continue;

      const originalPhones = [...org.phone_numbers];
      const fixedPhones = [];
      let hasChanges = false;

      for (const phone of originalPhones) {
        const fixedPhone = formatPhoneNumber(phone);
        if (fixedPhone) {
          fixedPhones.push(fixedPhone);
          if (fixedPhone !== phone) {
            console.log(`  🏢 ${org.organisation_name}: "${phone}" → "${fixedPhone}"`);
            hasChanges = true;
            orgPhoneFixed++;
          }
        } else {
          console.log(`  ❌ ${org.organisation_name}: Could not fix "${phone}"`);
        }
      }

      if (hasChanges) {
        org.phone_numbers = fixedPhones;
        await org.save();
        orgFixed++;
      } else {
        console.log(`  ✓ ${org.organisation_name}: All phones already correct`);
      }
    }

    console.log(`\n📈 Organisations: ${orgFixed} fixed, ${orgPhoneFixed} phone numbers corrected\n`);
    console.log('✅ Phone number fix completed!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixPhoneNumbers();
