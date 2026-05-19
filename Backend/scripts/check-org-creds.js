import mongoose from 'mongoose';
import Organisation from '../models/organisation.model.js';

async function check() {
  await mongoose.connect('mongodb://localhost:27017/soc_dashboard');

  const orgs = await Organisation.find({});
  console.log('Total organisations:', orgs.length);

  for (const org of orgs) {
    console.log('\nOrganisation:', org.organisation_name || org._id);
    console.log('All fields:', Object.keys(org.toObject()).join(', '));
  }

  await mongoose.connection.close();
}

check();
