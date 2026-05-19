import mongoose from 'mongoose';
import User from './models/user.model.js';
import Role from './models/role.model.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkUserRole() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const user = await User.findOne({ email: 'test@codecnetworks.com' }).populate('role');
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`User: ${user.email}`);
    console.log(`Role ID: ${user.role}`);
    console.log(`Role Name: ${user.role?.name || 'Role not populated'}`);
    console.log(`Is Active: ${user.is_active}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

checkUserRole();