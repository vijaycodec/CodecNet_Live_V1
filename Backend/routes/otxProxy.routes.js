import express from "express";
import { getOTXThreatData, clearOTXCache, getOTXCacheStats } from "../controllers/otxProxy.controller.js";
import { rateLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

/**
 * AlienVault OTX Proxy Routes
 *
 * PURPOSE: Proxy OTX API requests to keep API key server-side
 *
 * SECURITY NOTES:
 * - No authentication required (public threat intelligence)
 * - Rate limiting applied to prevent abuse
 * - API key stored server-side only
 * - Caching enabled (20-minute TTL)
 *
 * PATCH 47 Extension: OTX proxy endpoint
 */

// Get OTX threat data (with caching)
// Rate limit: 10 requests per minute per IP
router.get(
  "/",
  rateLimiter({ windowMs: 60000, max: 10 }),
  getOTXThreatData
);

// Get cache statistics
router.get(
  "/cache/stats",
  getOTXCacheStats
);

// Clear cache
router.post(
  "/clear-cache",
  rateLimiter({ windowMs: 60000, max: 5 }),
  clearOTXCache
);

export default router;
