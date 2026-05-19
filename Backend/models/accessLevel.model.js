// models/accessLevel.model.js
import mongoose from 'mongoose';

const accessLevelSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true 
}, // e.g., L1, L2, L3
  order: { 
    type: Number, 
    required: true 
},              // 1 = lowest, higher = more access
});

const AccessLevel = mongoose.model('AccessLevel', accessLevelSchema);
export default AccessLevel;
