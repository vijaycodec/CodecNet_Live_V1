import crypto from 'crypto';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import { ApiError } from './ApiError.js';

/**
 * Password security utilities
 */
export class PasswordUtils {
  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generate secure random password using cryptographically secure random values
   */
  static generateSecurePassword(length = 16) {
    if (length < 8) {
      throw new Error('Password length must be at least 8 characters');
    }

    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const charset = lowercase + uppercase + numbers + special;

    // Build password array with required characters first
    const passwordArray = [
      this._getSecureRandomChar(lowercase),
      this._getSecureRandomChar(uppercase),
      this._getSecureRandomChar(numbers),
      this._getSecureRandomChar(special)
    ];

    // Fill remaining length with random characters from full charset
    for (let i = 4; i < length; i++) {
      passwordArray.push(this._getSecureRandomChar(charset));
    }

    // Cryptographically secure shuffle using Fisher-Yates algorithm
    for (let i = passwordArray.length - 1; i > 0; i--) {
      const randomIndex = crypto.randomInt(0, i + 1);
      [passwordArray[i], passwordArray[randomIndex]] = [passwordArray[randomIndex], passwordArray[i]];
    }

    return passwordArray.join('');
  }

  /**
   * Get a cryptographically secure random character from a charset
   * @private
   */
  static _getSecureRandomChar(charset) {
    const randomIndex = crypto.randomInt(0, charset.length);
    return charset[randomIndex];
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password) {
    const minLength = 8;
    const maxLength = 128;
    
    const requirements = {
      length: password.length >= minLength && password.length <= maxLength,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&]/.test(password)
    };
    
    const score = Object.values(requirements).filter(Boolean).length;
    
    return {
      isValid: Object.values(requirements).every(Boolean),
      score: score,
      requirements: requirements,
      strength: score < 3 ? 'weak' : score < 4 ? 'medium' : 'strong'
    };
  }
}

/**
 * Two-Factor Authentication utilities
 */
export class TwoFactorUtils {
  /**
   * Generate 2FA secret and QR code
   */
  static async generateTwoFactorSecret(userEmail, serviceName = 'SOC Dashboard') {
    const secret = speakeasy.generateSecret({
      name: `${serviceName} (${userEmail})`,
      issuer: serviceName,
      length: 32
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    
    return {
      secret: secret.base32,
      qr_code: qrCodeUrl,
      manual_entry_key: secret.base32,
      backup_codes: this.generateBackupCodes()
    };
  }

  /**
   * Verify 2FA token
   */
  static verifyTwoFactorToken(token, secret, window = 2) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: window
    });
  }

  /**
   * Generate backup codes for 2FA
   */
  static generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * Hash backup codes for storage
   */
  static async hashBackupCodes(codes) {
    const hashedCodes = [];
    for (const code of codes) {
      hashedCodes.push(await bcrypt.hash(code, 10));
    }
    return hashedCodes;
  }

  /**
   * Verify backup code
   */
  static async verifyBackupCode(code, hashedCodes) {
    for (let i = 0; i < hashedCodes.length; i++) {
      if (await bcrypt.compare(code, hashedCodes[i])) {
        return { valid: true, index: i };
      }
    }
    return { valid: false, index: -1 };
  }
}

/**
 * JWT Token utilities
 */
export class TokenUtils {
  /**
   * Generate access token
   */
  static generateAccessToken(payload, expiresIn = '15m') {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload, expiresIn = '7d') {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn });
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  }

  /**
   * Generate password reset token
   */
  static generatePasswordResetToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    return {
      token: token,
      hashedToken: hashedToken,
      expires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };
  }

  /**
   * Generate email verification token
   */
  static generateEmailVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate API key
   */
  static generateApiKey(prefix = 'soc') {
    const randomPart = crypto.randomBytes(32).toString('base64url');
    return `${prefix}_${randomPart}`;
  }
}

/**
 * Encryption utilities
 */
export class EncryptionUtils {
  static algorithm = 'aes-256-gcm';

  /**
   * Derive a cryptographically secure key from password/passphrase
   * @private
   */
  static _deriveKey(password, salt = null) {
    // Use a fixed salt for consistency, or pass a custom salt
    // In production, you should store the salt with encrypted data
    const fixedSalt = salt || crypto.createHash('sha256').update('soc-dashboard-salt').digest();

    // Derive 32-byte key for AES-256 using scrypt (more secure than MD5-based derivation)
    // scryptSync(password, salt, keyLength, options)
    return crypto.scryptSync(password, fixedSalt, 32);
  }

  /**
   * Encrypt sensitive data using AES-256-GCM with proper key derivation
   */
  static encrypt(text, key = process.env.ENCRYPTION_KEY) {
    if (!key) {
      throw new ApiError(500, 'Encryption key not configured');
    }

    try {
      // Generate cryptographically secure random IV (96 bits / 12 bytes for GCM)
      const iv = crypto.randomBytes(12);

      // Derive proper 32-byte key from the provided key/password
      const derivedKey = this._deriveKey(key);

      // Create cipher with proper IV
      const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);

      // Encrypt the data
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag (GCM mode provides authenticated encryption)
      const authTag = cipher.getAuthTag();

      return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new ApiError(500, `Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM with proper key derivation
   */
  static decrypt(encryptedData, key = process.env.ENCRYPTION_KEY) {
    if (!key) {
      throw new ApiError(500, 'Encryption key not configured');
    }

    try {
      const { encrypted, iv, authTag } = encryptedData;

      if (!encrypted || !iv || !authTag) {
        throw new ApiError(400, 'Invalid encrypted data format. Missing required fields.');
      }

      // Derive the same key used for encryption
      const derivedKey = this._deriveKey(key);

      // Create decipher with IV
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        derivedKey,
        Buffer.from(iv, 'hex')
      );

      // Set authentication tag for GCM verification
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // Authentication tag verification failed or decryption error
      throw new ApiError(500, `Decryption failed: ${error.message}`);
    }
  }

  /**
   * Hash sensitive data (one-way)
   */
  static hash(data, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * Generate HMAC signature
   */
  static generateHMAC(data, secret, algorithm = 'sha256') {
    return crypto.createHmac(algorithm, secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  static verifyHMAC(data, signature, secret, algorithm = 'sha256') {
    const expectedSignature = this.generateHMAC(data, secret, algorithm);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
}

/**
 * Security validation utilities
 */
export class SecurityValidation {
  /**
   * Validate IP address
   */
  static isValidIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Check if IP is in allowed range
   */
  static isIPInRange(ip, ranges) {
    // Implementation would depend on IP range checking library
    // For now, simple array check
    return ranges.includes(ip);
  }

  /**
   * Detect suspicious user agent
   */
  static isSuspiciousUserAgent(userAgent) {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Validate device fingerprint
   */
  static validateDeviceFingerprint(fingerprint) {
    // Basic validation - in practice, this would be more sophisticated
    return typeof fingerprint === 'string' && fingerprint.length >= 32;
  }

  /**
   * Check for SQL injection patterns
   */
  static containsSQLInjection(input) {
    const sqlPatterns = [
      /('|(\-\-)|(;)|(\|\|)|(\*\*))/i,
      /(union|select|insert|delete|update|create|drop|exec|execute)/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for XSS patterns
   */
  static containsXSS(input) {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  }
}

/**
 * Session security utilities
 */
export class SessionSecurity {
  /**
   * Generate secure session ID
   */
  static generateSessionId() {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate device fingerprint
   */
  static generateDeviceFingerprint(req) {
    const components = [
      req.headers['user-agent'] || '',
      req.headers['accept-language'] || '',
      req.headers['accept-encoding'] || '',
      req.ip || '',
      req.headers['x-forwarded-for'] || ''
    ];
    
    return crypto.createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  /**
   * Validate session integrity
   */
  static validateSessionIntegrity(session, currentFingerprint) {
    if (!session || !session.device_fingerprint) {
      return false;
    }
    
    return session.device_fingerprint === currentFingerprint;
  }

  /**
   * Check session expiry
   */
  static isSessionExpired(session, maxAge = 24 * 60 * 60 * 1000) {
    if (!session || !session.last_activity) {
      return true;
    }
    
    const now = new Date();
    const lastActivity = new Date(session.last_activity);
    
    return (now - lastActivity) > maxAge;
  }
}

/**
 * Rate limiting security
 */
export class RateLimitSecurity {
  /**
   * Generate rate limit key
   */
  static generateRateLimitKey(identifier, action) {
    return `ratelimit:${action}:${identifier}`;
  }

  /**
   * Check if IP should be blocked
   */
  static shouldBlockIP(attempts, maxAttempts = 10) {
    return attempts >= maxAttempts;
  }

  /**
   * Calculate retry after time
   */
  static calculateRetryAfter(attempts, baseDelay = 60) {
    // Exponential backoff with jitter
    const delay = baseDelay * Math.pow(2, Math.min(attempts - 1, 5));
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  }
}

export default {
  PasswordUtils,
  TwoFactorUtils,
  TokenUtils,
  EncryptionUtils,
  SecurityValidation,
  SessionSecurity,
  RateLimitSecurity
};