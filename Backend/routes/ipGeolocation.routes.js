// PATCH 47: IP Geolocation Proxy Routes
import express from 'express';
import {
  getIpGeolocation,
  getBatchIpGeolocation,
  clearGeolocationCache,
  getCacheStats
} from '../controllers/ipGeolocation.controller.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for IP geolocation endpoints
const geoRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  message: 'Too many geolocation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const batchRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 batch requests per minute
  message: 'Too many batch requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const cacheRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 cache operations per hour
  message: 'Too many cache operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
router.get('/:ip', geoRateLimiter, getIpGeolocation);
router.post('/batch', batchRateLimiter, getBatchIpGeolocation);
router.post('/clear-cache', cacheRateLimiter, clearGeolocationCache);
router.get('/cache/stats', getCacheStats);

export default router;
