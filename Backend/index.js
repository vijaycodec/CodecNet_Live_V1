import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import database from "./config/database.js";
import apiRoutes from "./routes/index.js";
import { swaggerDocs } from "./swagger.js";
import { initializeCacheRefresh } from "./services/cacheRefresh.service.js";

// ES modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
dotenv.config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const corsOption = {
  origin: "*",
  credentials: true,
};

app.use(cors(corsOption));
app.use("/api", apiRoutes);

swaggerDocs(app);

const PORT = process.env.PORT || 5001;
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Function to start server with HTTP or HTTPS
const startServer = async () => {
  // Connect to database first
  try {
    await database.connect();
  } catch (error) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  if (ENABLE_HTTPS && NODE_ENV === 'production') {
    try {
      // Load SSL certificate and key
      const sslKeyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'server.key');
      const sslCertPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'server.cert');
      const sslCaPath = process.env.SSL_CA_PATH; // Optional CA bundle

      // Check if SSL files exist
      if (!fs.existsSync(sslKeyPath) || !fs.existsSync(sslCertPath)) {
        console.error('❌ SSL certificate files not found!');
        console.error(`   Expected key: ${sslKeyPath}`);
        console.error(`   Expected cert: ${sslCertPath}`);
        console.error('   Falling back to HTTP...');
        console.error('   See documentation for SSL setup instructions.');
        startHTTPServer();
        return;
      }

      const httpsOptions = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
        minVersion: 'TLSv1.2', // Enforce minimum TLS 1.2
        maxVersion: 'TLSv1.3', // Allow up to TLS 1.3
        ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
        ...(sslCaPath && fs.existsSync(sslCaPath) && { ca: fs.readFileSync(sslCaPath) })
      };

      const httpsServer = https.createServer(httpsOptions, app);

      httpsServer.listen(PORT, () => {
        console.log(`🔒 HTTPS Server is running securely at https://localhost:${PORT}`);
        console.log(`   Environment: ${NODE_ENV}`);
        console.log(`   SSL Certificate: ${sslCertPath}`);
        initializeCacheRefresh();
      });

      httpsServer.on('error', (error) => {
        console.error('❌ HTTPS Server error:', error.message);
        console.error('   Falling back to HTTP...');
        startHTTPServer();
      });

    } catch (error) {
      console.error('❌ Failed to start HTTPS server:', error.message);
      console.error('   Falling back to HTTP...');
      startHTTPServer();
    }
  } else {
    startHTTPServer();
  }
};

// Function to start HTTP server (development/fallback)
const startHTTPServer = () => {
  const httpServer = http.createServer(app);

  httpServer.listen(PORT, () => {
    if (NODE_ENV === 'production') {
      console.warn('⚠️  WARNING: Running HTTP in production is insecure!');
      console.warn('   Please enable HTTPS by setting ENABLE_HTTPS=true');
      console.warn('   and providing valid SSL certificates.');
    }
    console.log(`🌐 HTTP Server is running at http://localhost:${PORT}`);
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   HTTPS Enabled: ${ENABLE_HTTPS}`);
    initializeCacheRefresh();
  });

  httpServer.on('error', (error) => {
    console.error('❌ HTTP Server error:', error.message);
    process.exit(1);
  });
};

// Start the server
startServer();

export default app;
