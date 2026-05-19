import AccessLevel from '../models/accessLevel.model.js';

// Create Access Level
export const createAccessLevel = async (req, res) => {
  try {
    const { name, order } = req.body;

    if (!name || !order) {
      return res.status(400).json({ success: false, message: 'Name and order are required.' });
    }

    const existing = await AccessLevel.findOne({ name });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Access level already exists.' });
    }

    const newAccessLevel = await AccessLevel.create({ name, order });

    res.status(201).json({
      success: true,
      message: 'Access level created successfully.',
      accessLevel: newAccessLevel,
    });
  } catch (error) {
    console.error('Create Access Level Error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Get All Access Levels
export const getAllAccessLevels = async (req, res) => {
  try {
    const accessLevels = await AccessLevel.find().sort({ order: 1 });

    if (!accessLevels || accessLevels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No access levels found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Access levels retrieved successfully.',
      accessLevels,
    });
  } catch (error) {
    console.error('Get Access Levels Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
      error: error.message,
    });
  }
};

// Get Single Access Level by ID
export const getAccessLevelById = async (req, res) => {
  try {
    const accessLevel = await AccessLevel.findById(req.params.id);
    if (!accessLevel) {
      return res.status(404).json({ success: false, message: 'Access level not found.' });
    }
    res.status(200).json({ success: true, accessLevel });
  } catch (error) {
    console.error('Get Access Level Error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Update Access Level
export const updateAccessLevel = async (req, res) => {
  try {
    const { name, order } = req.body;
    const updated = await AccessLevel.findByIdAndUpdate(
      req.params.id,
      { name, order },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Access level not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Access level updated successfully.',
      accessLevel: updated,
    });
  } catch (error) {
    console.error('Update Access Level Error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Delete Access Level
export const deleteAccessLevel = async (req, res) => {
  try {
    const deleted = await AccessLevel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Access level not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Access level deleted successfully.',
    });
  } catch (error) {
    console.error('Delete Access Level Error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
