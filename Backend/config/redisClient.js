import redis from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379", // use localhost since Redis is running locally
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.log("Too many retries on REDIS. Connection Terminated");
        return new Error("Too many retries.");
      }
      return retries * 500; // exponential backoff
    },
  },
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err.message);
  // Don't crash the server on Redis errors
});

redisClient.on("connect", () => console.log("Redis Client Connected"));
redisClient.on("ready", () => console.log("Redis Client Ready"));
redisClient.on("reconnecting", () => console.log("Redis Client Reconnecting"));

redisClient.on("end", () => {
  console.log("Redis Client Connection Ended");
});

redisClient.on("disconnect", () => {
  console.log("Redis Client Disconnected");
});

// Temporarily disable Redis auto-connection to prevent startup crashes
// (async () => {
//   try {
//     await redisClient.connect();
//   } catch (error) {
//     console.log('Redis connection failed, continuing without Redis:', error.message);
//   }
// })();

console.log('Redis client configured but not auto-connecting');

export default redisClient;
