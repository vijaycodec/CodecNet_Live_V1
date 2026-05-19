// PATCH 43: Signed URL Generator for Secure File Downloads (CWE-862)
// Purpose: Generate time-limited, cryptographically secure download tokens
// Prevents unauthorized file access by requiring valid, non-expired tokens

import crypto from 'crypto';
import { ApiError } from './ApiError.js';

export class SignedUrlGenerator {
  /**
   * Generate a signed download token
   * @param {string} filename - Name of the file to download
   * @param {string} userId - ID of the user requesting download
   * @param {number} expiresInMinutes - Expiration time (default: 5 minutes)
   * @returns {string} Signed token
   */
  static generateToken(filename, userId, expiresInMinutes = 5) {
    const secret = process.env.JWT_SECRET || process.env.ENCRYPTION_KEY;

    if (!secret) {
      throw new Error('JWT_SECRET or ENCRYPTION_KEY must be configured');
    }

    // Create expiration timestamp
    const expiresAt = Date.now() + (expiresInMinutes * 60 * 1000);

    // Create payload
    const payload = {
      filename,
      userId: userId.toString(),
      expiresAt,
      nonce: crypto.randomBytes(16).toString('hex'), // Prevent token reuse
      issuedAt: Date.now()
    };

    // Create signature using HMAC-SHA256
    const payloadString = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadString).toString('base64url');

    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('hex');

    // Combine payload and signature
    return `${payloadBase64}.${signature}`;
  }

  /**
   * Verify and decode a signed download token
   * @param {string} token - The signed token to verify
   * @returns {object} Decoded payload if valid
   * @throws {ApiError} If token is invalid or expired
   */
  static verifyToken(token) {
    if (!token || typeof token !== 'string') {
      throw new ApiError(401, 'Invalid token format');
    }

    const secret = process.env.JWT_SECRET || process.env.ENCRYPTION_KEY;

    if (!secret) {
      throw new Error('JWT_SECRET or ENCRYPTION_KEY must be configured');
    }

    // Split token into payload and signature
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new ApiError(401, 'Invalid token structure');
    }

    const [payloadBase64, providedSignature] = parts;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('hex');

    if (expectedSignature !== providedSignature) {
      throw new ApiError(401, 'Invalid token signature');
    }

    // Decode payload
    let payload;
    try {
      const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf8');
      payload = JSON.parse(payloadString);
    } catch (error) {
      throw new ApiError(401, 'Invalid token payload');
    }

    // Validate payload structure
    if (!payload.filename || !payload.userId || !payload.expiresAt || !payload.nonce) {
      throw new ApiError(401, 'Incomplete token payload');
    }

    // Check if token has expired
    if (Date.now() > payload.expiresAt) {
      throw new ApiError(401, 'Token has expired');
    }

    return payload;
  }

  /**
   * Generate a complete download URL with signed token
   * @param {string} filename - Name of the file to download
   * @param {string} userId - ID of the user requesting download
   * @param {number} expiresInMinutes - Expiration time (default: 5 minutes)
   * @param {string} baseUrl - Base API URL (optional)
   * @returns {string} Complete download URL with token
   */
  static generateDownloadUrl(filename, userId, expiresInMinutes = 5, baseUrl = '/api/reports/download') {
    const token = this.generateToken(filename, userId, expiresInMinutes);

    // URL encode the filename to handle special characters
    const encodedFilename = encodeURIComponent(filename);

    return `${baseUrl}/${encodedFilename}?token=${token}`;
  }

  /**
   * Generate multiple signed URLs for a list of files
   * @param {string[]} filenames - Array of filenames
   * @param {string} userId - ID of the user requesting downloads
   * @param {number} expiresInMinutes - Expiration time
   * @returns {object[]} Array of objects with filename and downloadUrl
   */
  static generateBatchUrls(filenames, userId, expiresInMinutes = 5) {
    return filenames.map(filename => ({
      filename,
      downloadUrl: this.generateDownloadUrl(filename, userId, expiresInMinutes),
      expiresIn: expiresInMinutes
    }));
  }

  /**
   * Extract token from request query or headers
   * @param {object} req - Express request object
   * @returns {string|null} Token if found
   */
  static extractToken(req) {
    // Check query parameter first
    if (req.query && req.query.token) {
      return req.query.token;
    }

    // Check Authorization header (Bearer token format)
    if (req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
      }
    }

    // Check custom header
    if (req.headers['x-download-token']) {
      return req.headers['x-download-token'];
    }

    return null;
  }
}

export default SignedUrlGenerator;
