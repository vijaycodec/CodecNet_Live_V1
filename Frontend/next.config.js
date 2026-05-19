/** @type {import('next').NextConfig} */
const nextConfig = {
  // PATCH 52: Disable X-Powered-By header (CWE-200 Fix)
  // Remove frontend technology disclosure
  poweredByHeader: false,

  images: {
    domains: ['localhost', 'images.unsplash.com'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Allow cross-origin requests from development network IPs
  allowedDevOrigins: [
    'localhost',
    '192.168.1.0/24', // Allow entire local network range
    '10.0.0.0/8',     // Allow private IP ranges
    '172.16.0.0/12',  // Allow private IP ranges
  ],

  // SECURITY FIX (PATCH 39): Add security headers to prevent clickjacking (CWE-1021)
  // Clickjacking protection and additional security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; font-src 'self' data:; connect-src 'self' http://localhost:5555 http://localhost:5000 http://ip-api.com https://ipapi.co http://ipwhois.app https://raw.githubusercontent.com http://unpkg.com https://unpkg.com https://www.google.com https://www.gstatic.com; frame-src https://www.google.com;",
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // PATCH 50: Fix ChunkLoadError for react-globe.gl and three.js modules
  webpack: (config, { isServer }) => {
    // Handle ESM modules that have issues with Next.js
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Fix for react-globe.gl and three.js modules (.mjs files)
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });

    return config;
  },
}

module.exports = nextConfig 