// PATCH 60: Input Validation Utilities (CWE-20)
// Purpose: Prevent injection attacks, XSS, path traversal, and other input-based vulnerabilities
// Follows OWASP Input Validation Guidelines

import validator from 'validator';
import mongoose from 'mongoose';

/**
 * Sanitize string input by removing null bytes and control characters
 */
export const sanitizeString = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '')              // Remove null bytes (CWE-158)
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
};

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const sanitized = sanitizeString(email);

  if (sanitized.length > 254) {
    return { valid: false, error: 'Email must not exceed 254 characters' };
  }

  if (!validator.isEmail(sanitized)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, sanitized: sanitized.toLowerCase() };
};

/**
 * Validate username
 * @param {string} username - Username to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const sanitized = sanitizeString(username);

  if (sanitized.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (sanitized.length > 50) {
    return { valid: false, error: 'Username must not exceed 50 characters' };
  }

  // Allow alphanumeric, dots, hyphens, underscores
  if (!/^[a-zA-Z0-9._-]+$/.test(sanitized)) {
    return { valid: false, error: 'Username can only contain letters, numbers, dots, hyphens, and underscores' };
  }

  return { valid: true, sanitized };
};

/**
 * Validate password
 * @param {string} password - Password to validate
 * @returns {{valid: boolean, error?: string}}
 */
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  // Check for null bytes
  if (/\0/.test(password)) {
    return { valid: false, error: 'Password contains invalid characters' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password must not exceed 128 characters' };
  }

  return { valid: true };
};

/**
 * Validate full name
 * @param {string} name - Full name to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export const validateFullName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Full name is required' };
  }

  const sanitized = sanitizeString(name);

  if (sanitized.length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters' };
  }

  if (sanitized.length > 100) {
    return { valid: false, error: 'Full name must not exceed 100 characters' };
  }

  // Allow letters, spaces, hyphens, apostrophes
  if (!/^[a-zA-Z\s'-]+$/.test(sanitized)) {
    return { valid: false, error: 'Full name can only contain letters, spaces, hyphens, and apostrophes' };
  }

  return { valid: true, sanitized };
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }

  const sanitized = sanitizeString(phone);

  // Remove common formatting characters
  const digitsOnly = sanitized.replace(/[\s()-]/g, '');

  // Check if it starts with + (international format)
  const hasPlus = digitsOnly.startsWith('+');
  const numberPart = hasPlus ? digitsOnly.substring(1) : digitsOnly;

  if (!/^\d+$/.test(numberPart)) {
    return { valid: false, error: 'Phone number can only contain digits and optional + prefix' };
  }

  if (numberPart.length < 10 || numberPart.length > 15) {
    return { valid: false, error: 'Phone number must be between 10 and 15 digits' };
  }

  return { valid: true, sanitized };
};

/**
 * Validate MongoDB ObjectId
 * @param {string} id - ObjectId to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export const validateObjectId = (id) => {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'ID is required' };
  }

  const sanitized = sanitizeString(id);

  if (!mongoose.Types.ObjectId.isValid(sanitized)) {
    return { valid: false, error: 'Invalid ID format' };
  }

  return { valid: true, sanitized };
};

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export const validateURL = (url) => {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const sanitized = sanitizeString(url);

  if (sanitized.length > 2048) {
    return { valid: false, error: 'URL must not exceed 2048 characters' };
  }

  if (!validator.isURL(sanitized, { protocols: ['http', 'https'], require_protocol: true })) {
    return { valid: false, error: 'Invalid URL format (must be http or https)' };
  }

  return { valid: true, sanitized };
};

/**
 * Validate IP address (IPv4 or IPv6)
 * @param {string} ip - IP address to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export const validateIP = (ip) => {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, error: 'IP address is required' };
  }

  const sanitized = sanitizeString(ip);

  const isIPv4 = validator.isIP(sanitized, 4);
  const isIPv6 = validator.isIP(sanitized, 6);

  if (!isIPv4 && !isIPv6) {
    return { valid: false, error: 'Invalid IP address format' };
  }

  return { valid: true, sanitized };
};

/**
 * Validate port number
 * @param {number|string} port - Port number to validate
 * @returns {{valid: boolean, error?: string, sanitized?: number}}
 */
export const validatePort = (port) => {
  if (port === null || port === undefined) {
    return { valid: false, error: 'Port number is required' };
  }

  const portNum = typeof port === 'string' ? parseInt(port, 10) : port;

  if (isNaN(portNum)) {
    return { valid: false, error: 'Port must be a number' };
  }

  if (portNum < 1 || portNum > 65535) {
    return { valid: false, error: 'Port must be between 1 and 65535' };
  }

  return { valid: true, sanitized: portNum };
};

/**
 * Validate TOTP code (6-digit)
 * @param {string} code - TOTP code to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export const validateTOTP = (code) => {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'TOTP code is required' };
  }

  const sanitized = sanitizeString(code);

  if (!/^\d{6}$/.test(sanitized)) {
    return { valid: false, error: 'TOTP code must be 6 digits' };
  }

  return { valid: true, sanitized };
};

/**
 * Validate generic text input
 * @param {string} text - Text to validate
 * @param {object} options - Validation options
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export const validateText = (text, options = {}) => {
  const {
    required = false,
    minLength = 0,
    maxLength = 5000,
    fieldName = 'Text'
  } = options;

  if (!text || typeof text !== 'string') {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: '' };
  }

  const sanitized = sanitizeString(text);

  if (sanitized.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (sanitized.length > maxLength) {
    return { valid: false, error: `${fieldName} must not exceed ${maxLength} characters` };
  }

  return { valid: true, sanitized };
};

/**
 * Validate boolean value
 * @param {any} value - Value to validate as boolean
 * @returns {{valid: boolean, error?: string, sanitized?: boolean}}
 */
export const validateBoolean = (value) => {
  if (typeof value === 'boolean') {
    return { valid: true, sanitized: value };
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1') {
      return { valid: true, sanitized: true };
    }
    if (lower === 'false' || lower === '0') {
      return { valid: true, sanitized: false };
    }
  }

  if (typeof value === 'number') {
    return { valid: true, sanitized: value !== 0 };
  }

  return { valid: false, error: 'Invalid boolean value' };
};

/**
 * Validate number within range
 * @param {any} value - Value to validate
 * @param {object} options - Validation options
 * @returns {{valid: boolean, error?: string, sanitized?: number}}
 */
export const validateNumber = (value, options = {}) => {
  const {
    required = false,
    min = -Infinity,
    max = Infinity,
    integer = false,
    fieldName = 'Number'
  } = options;

  if (value === null || value === undefined || value === '') {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: null };
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  if (integer && !Number.isInteger(num)) {
    return { valid: false, error: `${fieldName} must be an integer` };
  }

  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (num > max) {
    return { valid: false, error: `${fieldName} must not exceed ${max}` };
  }

  return { valid: true, sanitized: num };
};

/**
 * Validate array of values
 * @param {any} value - Value to validate as array
 * @param {object} options - Validation options
 * @returns {{valid: boolean, error?: string, sanitized?: array}}
 */
export const validateArray = (value, options = {}) => {
  const {
    required = false,
    minLength = 0,
    maxLength = Infinity,
    itemValidator = null,
    fieldName = 'Array'
  } = options;

  if (!value) {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: [] };
  }

  if (!Array.isArray(value)) {
    return { valid: false, error: `${fieldName} must be an array` };
  }

  if (value.length < minLength) {
    return { valid: false, error: `${fieldName} must contain at least ${minLength} items` };
  }

  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} must not exceed ${maxLength} items` };
  }

  // Validate each item if validator provided
  if (itemValidator && typeof itemValidator === 'function') {
    const sanitizedItems = [];
    for (let i = 0; i < value.length; i++) {
      const result = itemValidator(value[i]);
      if (!result.valid) {
        return { valid: false, error: `${fieldName}[${i}]: ${result.error}` };
      }
      sanitizedItems.push(result.sanitized);
    }
    return { valid: true, sanitized: sanitizedItems };
  }

  return { valid: true, sanitized: value };
};

/**
 * Prevent path traversal attacks
 * @param {string} path - File path to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export const validateFilePath = (path) => {
  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'File path is required' };
  }

  const sanitized = sanitizeString(path);

  // Check for path traversal attempts
  if (sanitized.includes('..') || sanitized.includes('//')) {
    return { valid: false, error: 'Invalid file path (path traversal detected)' };
  }

  // Check for null bytes
  if (/\0/.test(sanitized)) {
    return { valid: false, error: 'File path contains invalid characters' };
  }

  return { valid: true, sanitized };
};

/**
 * Validate date string
 * @param {string} date - Date string to validate
 * @returns {{valid: boolean, error?: string, sanitized?: Date}}
 */
export const validateDate = (date) => {
  if (!date) {
    return { valid: false, error: 'Date is required' };
  }

  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  return { valid: true, sanitized: dateObj };
};

// Export all validators
export default {
  sanitizeString,
  validateEmail,
  validateUsername,
  validatePassword,
  validateFullName,
  validatePhone,
  validateObjectId,
  validateURL,
  validateIP,
  validatePort,
  validateTOTP,
  validateText,
  validateBoolean,
  validateNumber,
  validateArray,
  validateFilePath,
  validateDate
};
