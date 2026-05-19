import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

/**
 * MongoDB connection configuration
 */
class Database {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  /**
   * Connect to MongoDB database
   */
  async connect() {
    try {
      // MongoDB connection options
      const options = {
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        family: 4 // Use IPv4, skip trying IPv6
      };

      // Connect to MongoDB
      const connection = await mongoose.connect(process.env.MONGODB_URI, options);
      
      this.connection = connection;
      this.isConnected = true;

      console.log('✅ MongoDB connected successfully');
      console.log(`📍 Connected to: ${connection.connection.host}:${connection.connection.port}`);
      console.log(`🗄️  Database: ${connection.connection.name}`);

      // Handle connection events
      mongoose.connection.on('error', this.handleError);
      mongoose.connection.on('disconnected', this.handleDisconnected);
      mongoose.connection.on('reconnected', this.handleReconnected);

      return connection;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw new ApiError(500, `Database connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    try {
      if (this.isConnected) {
        await mongoose.disconnect();
        this.isConnected = false;
        console.log('✅ MongoDB disconnected successfully');
      }
    } catch (error) {
      console.error('❌ MongoDB disconnection failed:', error);
      throw new ApiError(500, `Database disconnection failed: ${error.message}`);
    }
  }

  /**
   * Check if database is connected
   */
  isHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get connection status
   */
  getStatus() {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    
    return {
      state: states[mongoose.connection.readyState],
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      collections: Object.keys(mongoose.connection.collections)
    };
  }

  /**
   * Handle connection errors
   */
  handleError = (error) => {
    console.error('❌ MongoDB connection error:', error);
    this.isConnected = false;
  }

  /**
   * Handle disconnection
   */
  handleDisconnected = () => {
    console.warn('⚠️ MongoDB disconnected');
    this.isConnected = false;
  }

  /**
   * Handle reconnection
   */
  handleReconnected = () => {
    console.log('✅ MongoDB reconnected');
    this.isConnected = true;
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown() {
    console.log('🔄 Initiating database graceful shutdown...');
    
    try {
      await this.disconnect();
      console.log('✅ Database graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Database graceful shutdown failed:', error);
      process.exit(1);
    }
  }
}

// Create singleton instance
const database = new Database();

// Handle process termination
process.on('SIGINT', () => database.gracefulShutdown());
process.on('SIGTERM', () => database.gracefulShutdown());
process.on('SIGUSR2', () => database.gracefulShutdown()); // For nodemon restarts

export default database;
export { Database };