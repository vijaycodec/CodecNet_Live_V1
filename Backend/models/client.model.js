import mongoose from "mongoose";

const clientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', required: true, unique: true
},

  // PATCH 19: Fixed schema syntax - select must be outside type definition
  wazuhCredentials: {
    type: {
      host: String,
      username: String,
      password: String
    },
    select: false  // SECURITY: Never include in default queries
  },
  indexerCredentials: {
    type: {
      host: String,
      username: String,
      password: String
    },
    select: false  // SECURITY: Never include in default queries
  },

  is_active: { type: Boolean, default: true }
}, {
  toJSON: {
    transform: function(doc, ret) {
      // SECURITY: Remove credentials from JSON output
      delete ret.wazuhCredentials;
      delete ret.indexerCredentials;
      return ret;
    }
  }
});

const Client = mongoose.model('Client', clientSchema);
export default Client;

