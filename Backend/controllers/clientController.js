import Client from '../models/client.model.js';
import User from '../models/user.model.js';
import mongoose from 'mongoose';

/**
 * Create a client profile with Wazuh and Indexer credentials
 */
export const createClient = async (req, res) => {
  try {
    const { user, wazuhCredentials, indexerCredentials } = req.body;

    // Validate required fields
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User ID is required to create a client profile.",
      });
    }

    // Check if the user exists
    const existingUser = await User.findById(user);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Check if the client profile already exists for this user
    const existingClient = await Client.findOne({ user });
    if (existingClient) {
      return res.status(409).json({
        success: false,
        message: "Client profile already exists for this user.",
      });
    }

    // Create the client profile
    const client = await Client.create(req.body);

    // SECURITY: Return only safe fields, credentials removed
    const safeData = {
      _id: client._id,
      user: client.user,
      is_active: client.is_active
    };

    return res.status(201).json({
      success: true,
      message: 'Client profile created successfully.',
      data: safeData
    });

  } catch (error) {
    console.error('Create Client Error:', error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating client profile.",
      error: error.message,
    });
  }
};

// Get All Clients
export const getAllClients = async (req, res) => {
  try {
    // SECURITY: Explicitly exclude credentials
    const clients = await Client.find()
      .select('-wazuhCredentials -indexerCredentials')
      .populate('user', 'full_name email username');

    if (!clients || clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No clients found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Clients fetched successfully.',
      data: clients,
    });

  } catch (error) {
    console.error('Get All Clients Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while fetching clients.',
      error: error.message,
    });
  }
};

// Get Client by ID
export const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID format',
      });
    }

    //  Fetch client and populate user fields
    // SECURITY: Explicitly exclude credentials
    const client = await Client.findById(id)
      .select('-wazuhCredentials -indexerCredentials')
      .populate('user', 'full_name email username');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Client fetched successfully',
      data: client,
    });
  } catch (err) {
    console.error('Error fetching client by ID:', err);

    return res.status(500).json({
      success: false,
      message: 'Server error while fetching client',
      error: err.message,
    });
  }
};

// Update Client
export const updateClient = async (req, res) => {
  try {
    const { wazuhCredentials, indexerCredentials, ...rest } = req.body;

    const updateData = {
      ...rest,
    };

    if (wazuhCredentials) {
      updateData.wazuhCredentials = {
        host: wazuhCredentials.host,
        username: wazuhCredentials.username,
        password: wazuhCredentials.password
      };
    }

    if (indexerCredentials) {
      updateData.indexerCredentials = {
        host: indexerCredentials.host,
        username: indexerCredentials.username,
        password: indexerCredentials.password
      };
    }

    const updatedClient = await Client.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedClient) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Client updated successfully',
      data: updatedClient,
    });
  } catch (error) {
    console.error('Update Client Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update client',
      error: error.message,
    });
  }
};

// Delete Client
export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Client ID is required.',
      });
    }

    const deletedClient = await Client.findByIdAndDelete(id);

    if (!deletedClient) {
      return res.status(404).json({
        success: false,
        message: `Client with ID ${id} not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Client deleted successfully.',
      deletedClient,
    });

  } catch (error) {
    console.error('Delete Client Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while deleting client.',
      error: error.message,
    });
  }
};
