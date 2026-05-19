import express from 'express';
import {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  syncAgentsToAssets,
  getAssetStatistics
} from '../controllers/assetRegister.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all assets (with optional organization filter)
router.get('/', getAssets);

// Get asset statistics
router.get('/statistics', getAssetStatistics);

// Sync agents from Wazuh to assets
router.post('/sync', syncAgentsToAssets);

// Get single asset by ID
router.get('/:id', getAssetById);

// Create new asset manually
router.post('/', createAsset);

// Update asset
router.put('/:id', updateAsset);

// Soft delete asset
router.delete('/:id', deleteAsset);

export default router;
