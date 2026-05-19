import mongoose from 'mongoose';
import Client from './models/client.model.js';
import User from './models/user.model.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabase() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/siem');
    console.log('✅ MongoDB connected\n');
    
    console.log('📊 Checking Users...');
    const users = await User.find({});
    console.log(`Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`  - ${user.username || user.email} (ID: ${user._id})`);
    });
    
    console.log('\n📊 Checking Client Credentials...');
    const clients = await Client.find({});
    console.log(`Found ${clients.length} client configurations:`);
    
    clients.forEach((client, index) => {
      console.log(`\nClient ${index + 1}:`);
      console.log(`  User ID: ${client.user}`);
      console.log(`  Wazuh Host: ${client.wazuhCredentials?.host || 'NOT SET'}`);
      console.log(`  Wazuh Username: ${client.wazuhCredentials?.username || 'NOT SET'}`);
      console.log(`  Wazuh Password: ${client.wazuhCredentials?.password ? '[SET]' : 'NOT SET'}`);
      console.log(`  Indexer Host: ${client.indexerCredentials?.host || 'NOT SET'}`);
      console.log(`  Indexer Username: ${client.indexerCredentials?.username || 'NOT SET'}`);
      console.log(`  Indexer Password: ${client.indexerCredentials?.password ? '[SET]' : 'NOT SET'}`);
      console.log(`  Active: ${client.is_active}`);
    });
    
    if (clients.length === 0) {
      console.log('❌ No client credentials found! This is likely why data is not coming through.');
      console.log('   You need to configure Wazuh and Indexer credentials for your users.');
    } else {
      // Check if any client has complete credentials
      const validClients = clients.filter(client => 
        client.wazuhCredentials?.host && 
        client.wazuhCredentials?.username && 
        client.wazuhCredentials?.password &&
        client.indexerCredentials?.host && 
        client.indexerCredentials?.username && 
        client.indexerCredentials?.password
      );
      
      if (validClients.length === 0) {
        console.log('❌ No clients have complete credentials configured!');
        console.log('   This is likely why data is not coming through.');
      } else {
        console.log(`✅ Found ${validClients.length} clients with complete credentials`);
      }
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔐 Database connection closed');
  }
}

checkDatabase();