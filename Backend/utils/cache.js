import redisClient from '../config/redisClient.js';

export const getCache = async (key) => {
  try {
    // Check if Redis client is ready before using
    if (!redisClient.isReady) {
      console.log('Redis not ready, skipping cache get');
      return null;
    }
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Redis GET error:', err.message);
    return null;
  }
};

export const setCache = async (key, data, ttl = 60) => {
  try {
    // Check if Redis client is ready before using
    if (!redisClient.isReady) {
      console.log('Redis not ready, skipping cache set');
      return;
    }
    await redisClient.setEx(key, ttl, JSON.stringify(data));
  } catch (err) {
    console.error('Redis SET error:', err.message);
  }
};