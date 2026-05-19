import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { setupErrorHandling } from './middlewares/index.js';

// ES modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('🔄 Starting SOC Dashboard Backend (Test Mode - No Database)');

/**
 * Security Middleware
 */
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

/**
 * CORS Configuration
 */
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

/**
 * Request Parsing Middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Logging Middleware
 */
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

/**
 * API Routes
 */
app.use('/api', routes);

/**
 * Health Check Endpoint
 */
app.get('/health', async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SOC Dashboard API is healthy (Test Mode)',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      connected: false,
      status: 'test_mode',
      note: 'Running without database for testing'
    }
  });
});

/**
 * Root Endpoint
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SOC Dashboard API v2.0 (Test Mode)',
    version: '2.0.0',
    documentation: '/api',
    health: '/health',
    timestamp: new Date().toISOString(),
    note: 'Running without database - install MongoDB to enable full functionality'
  });
});

/**
 * Error Handling Setup
 */
setupErrorHandling(app);

/**
 * Start Server
 */
let server;

const startHTTPSServer = () => {
  try {
    const sslKeyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'server.key');
    const sslCertPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'server.cert');
    const sslCaPath = process.env.SSL_CA_PATH;

    if (!fs.existsSync(sslKeyPath) || !fs.existsSync(sslCertPath)) {
      console.error('❌ SSL certificate files not found!');
      console.error(`   Expected key: ${sslKeyPath}`);
      console.error(`   Expected cert: ${sslCertPath}`);
      console.error('   Falling back to HTTP...');
      console.error('   See SSL_SETUP_GUIDE.md for SSL setup instructions.');
      startHTTPServer();
      return;
    }

    const httpsOptions = {
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath),
      ...(sslCaPath && fs.existsSync(sslCaPath) && { ca: fs.readFileSync(sslCaPath) })
    };

    server = https.createServer(httpsOptions, app);

    server.listen(PORT, () => {
      console.log('🚀 ===================================');
      console.log('🚀 SOC DASHBOARD BACKEND STARTED');
      console.log('🚀 ===================================');
      console.log(`🔒 HTTPS Server running on: https://localhost:${PORT}`);
      console.log(`📚 API Documentation: https://localhost:${PORT}/api`);
      console.log(`❤️  Health Check: https://localhost:${PORT}/health`);
      console.log(`🔧 Environment: ${NODE_ENV}`);
      console.log(`   SSL Certificate: ${sslCertPath}`);
      console.log('⚠️  Test Mode: MongoDB not connected');
      console.log('🚀 ===================================');
    });

    server.on('error', (error) => {
      console.error('❌ HTTPS Server error:', error.message);
      console.error('   Falling back to HTTP...');
      startHTTPServer();
    });
  } catch (error) {
    console.error('❌ Failed to start HTTPS server:', error.message);
    console.error('   Falling back to HTTP...');
    startHTTPServer();
  }
};

const startHTTPServer = () => {
  server = http.createServer(app);

  server.listen(PORT, () => {
    if (NODE_ENV === 'production') {
      console.warn('⚠️  WARNING: Running HTTP in production is insecure!');
      console.warn('   Please enable HTTPS by setting ENABLE_HTTPS=true in .env');
      console.warn('   and providing valid SSL certificates.');
      console.warn('   See SSL_SETUP_GUIDE.md for instructions.');
    }
    console.log('🚀 ===================================');
    console.log('🚀 SOC DASHBOARD BACKEND STARTED');
    console.log('🚀 ===================================');
    console.log(`🌐 HTTP Server running on: http://localhost:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
    console.log(`🔧 Environment: ${NODE_ENV}`);
    console.log(`   HTTPS Enabled: ${ENABLE_HTTPS}`);
    console.log('⚠️  Test Mode: MongoDB not connected');
    console.log('🚀 ===================================');
  });

  server.on('error', (error) => {
    console.error('❌ HTTP Server error:', error.message);
    process.exit(1);
  });
};

// Start the server based on configuration
if (ENABLE_HTTPS && NODE_ENV === 'production') {
  startHTTPSServer();
} else {
  startHTTPServer();
}

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);

  server.close(() => {
    console.log('✅ Server closed');
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  });

  // Force close server after 30 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle process termination
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

export default app;