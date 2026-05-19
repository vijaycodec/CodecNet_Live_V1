// PATCH 60: Frontend Input Validation (CWE-20)
// Client-side validation for better UX and first line of defense

/**
 * Sanitize string input - remove dangerous characters
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') return '';

  // Remove null bytes, control characters, and trim whitespace
  return input
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
};

/**
 * Validate email address
 */
export const validateEmail = (email: string): { valid: boolean; error?: string; sanitized?: string } => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const sanitized = sanitizeString(email);

  // Email regex pattern
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailPattern.test(sanitized)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (sanitized.length > 254) {
    return { valid: false, error: 'Email too long (max 254 characters)' };
  }

  return { valid: true, sanitized };
};

/**
 * Validate username
 */
export const validateUsername = (username: string): { valid: boolean; error?: string; sanitized?: string } => {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const sanitized = sanitizeString(username);

  if (sanitized.length < 3 || sanitized.length > 50) {
    return { valid: false, error: 'Username must be 3-50 characters' };
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(sanitized)) {
    return { valid: false, error: 'Username can only contain letters, numbers, dots, underscores, and hyphens' };
  }

  if (!/^[a-zA-Z0-9]/.test(sanitized)) {
    return { valid: false, error: 'Username must start with a letter or number' };
  }

  return { valid: true, sanitized };
};

/**
 * Validate password
 */
export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.includes('\0')) {
    return { valid: false, error: 'Invalid password format' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password too long (max 128 characters)' };
  }

  return { valid: true };
};

/**
 * Validate login identifier (email or username)
 */
export const validateLoginIdentifier = (identifier: string): { valid: boolean; error?: string; sanitized?: string } => {
  if (!identifier || typeof identifier !== 'string') {
    return { valid: false, error: 'Email or username is required' };
  }

  const sanitized = sanitizeString(identifier);

  // Try email validation first
  const emailValidation = validateEmail(sanitized);
  const usernameValidation = validateUsername(sanitized);

  if (!emailValidation.valid && !usernameValidation.valid) {
    return { valid: false, error: 'Invalid email or username format' };
  }

  return { valid: true, sanitized };
};

/**
 * Validate required field (not empty)
 */
export const validateRequired = (value: any, fieldName = 'This field'): { valid: boolean; error?: string } => {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (typeof value === 'string' && sanitizeString(value).length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }

  return { valid: true };
};
