// PATCH 60: Authentication Input Validation Middleware (CWE-20)
import Joi from 'joi';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  validateEmail,
  validateUsername,
  validatePassword,
  validateFullName,
  validatePhone,
  validateObjectId,
  validateTOTP
} from '../utils/inputValidation.js';

export const validateLoginInput = (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const errors = [];

    if (!identifier) {
      errors.push('Email or username is required');
    } else {
      const emailValidation = validateEmail(identifier);
      const usernameValidation = validateUsername(identifier);

      if (!emailValidation.valid && !usernameValidation.valid) {
        errors.push('Invalid email or username format');
      } else {
        req.body.identifier = emailValidation.valid
          ? emailValidation.sanitized
          : usernameValidation.sanitized;
      }
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      errors.push(passwordValidation.error);
    }

    if (errors.length > 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Validation failed', { errors })
      );
    }

    next();
  } catch (error) {
    console.error('Login validation error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Validation error occurred')
    );
  }
};

export const validate2FAInput = (req, res, next) => {
  try {
    const { user_id, totp_code } = req.body;
    const errors = [];

    const userIdValidation = validateObjectId(user_id);
    if (!userIdValidation.valid) {
      errors.push('Invalid user ID');
    } else {
      req.body.user_id = userIdValidation.sanitized;
    }

    const totpValidation = validateTOTP(totp_code);
    if (!totpValidation.valid) {
      errors.push(totpValidation.error);
    } else {
      req.body.totp_code = totpValidation.sanitized;
    }

    if (errors.length > 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Validation failed', { errors })
      );
    }

    next();
  } catch (error) {
    console.error('2FA validation error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Validation error occurred')
    );
  }
};

export const validatePasswordResetRequest = (req, res, next) => {
  try {
    const { email } = req.body;
    const errors = [];

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      errors.push(emailValidation.error);
    } else {
      req.body.email = emailValidation.sanitized;
    }

    if (errors.length > 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Validation failed', { errors })
      );
    }

    next();
  } catch (error) {
    console.error('Password reset request validation error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Validation error occurred')
    );
  }
};

export const validatePasswordReset = (req, res, next) => {
  try {
    const { reset_token, new_password } = req.body;
    const errors = [];

    if (!reset_token || typeof reset_token !== 'string') {
      errors.push('Reset token is required');
    } else if (reset_token.length < 32 || reset_token.length > 128) {
      errors.push('Invalid reset token format');
    }

    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.valid) {
      errors.push(passwordValidation.error);
    }

    if (errors.length > 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Validation failed', { errors })
      );
    }

    next();
  } catch (error) {
    console.error('Password reset validation error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Validation error occurred')
    );
  }
};

export const validateChangePassword = (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const errors = [];

    const currentPasswordValidation = validatePassword(current_password);
    if (!currentPasswordValidation.valid) {
      errors.push('Current password: ' + currentPasswordValidation.error);
    }

    const newPasswordValidation = validatePassword(new_password);
    if (!newPasswordValidation.valid) {
      errors.push('New password: ' + newPasswordValidation.error);
    }

    if (current_password === new_password) {
      errors.push('New password must be different from current password');
    }

    if (errors.length > 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Validation failed', { errors })
      );
    }

    next();
  } catch (error) {
    console.error('Change password validation error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Validation error occurred')
    );
  }
};

// ========================================
// PATCH 53: Joi Validation Schemas for validateRequest middleware
// ========================================

/**
 * Login validation schema
 * PATCH 53: Added recaptchaToken validation (CWE-306)
 */
export const loginValidator = Joi.object({
  identifier: Joi.alternatives()
    .try(
      Joi.string().email({ minDomainSegments: 2 }),
      Joi.string().alphanum().min(3).max(30)
    )
    .required()
    .messages({
      'any.required': 'Email or username is required',
      'alternatives.match': 'Invalid email or username format'
    }),
  password: Joi.string()
    .min(8)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'Password is required'
    }),
  // PATCH 53: reCAPTCHA token validation (CWE-306)
  // ⚠️ WARNING: Currently optional for development
  // TODO: MUST be required in production - update to .required() before deployment
  // TODO: Implement frontend reCAPTCHA integration
  recaptchaToken: Joi.string()
    .optional()
    .allow('', null)
    .messages({
      'string.empty': 'reCAPTCHA token cannot be empty if provided'
    })
});

/**
 * 2FA verification schema
 */
export const verify2FAValidator = Joi.object({
  user_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'any.required': 'User ID is required',
      'string.pattern.base': 'Invalid user ID format'
    }),
  totp_code: Joi.string()
    .length(6)
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      'any.required': 'TOTP code is required',
      'string.length': 'TOTP code must be 6 digits',
      'string.pattern.base': 'TOTP code must contain only numbers'
    })
});

/**
 * Refresh token schema
 */
export const refreshTokenValidator = Joi.object({
  refresh_token: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required',
      'string.empty': 'Refresh token is required'
    })
});

/**
 * Password reset request schema
 */
export const passwordResetRequestValidator = Joi.object({
  email: Joi.string()
    .email({ minDomainSegments: 2 })
    .required()
    .messages({
      'any.required': 'Email is required',
      'string.email': 'Please provide a valid email address'
    })
});

/**
 * Password reset confirmation schema
 */
export const passwordResetValidator = Joi.object({
  reset_token: Joi.string()
    .min(32)
    .max(128)
    .required()
    .messages({
      'any.required': 'Reset token is required',
      'string.min': 'Invalid reset token format',
      'string.max': 'Invalid reset token format'
    }),
  new_password: Joi.string()
    .min(8)
    .max(128)
    .pattern(
      new RegExp(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'
      )
    )
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
      'any.required': 'New password is required'
    })
});

/**
 * Change password schema
 */
export const changePasswordValidator = Joi.object({
  current_password: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),
  new_password: Joi.string()
    .min(8)
    .max(128)
    .pattern(
      new RegExp(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'
      )
    )
    .required()
    .disallow(Joi.ref('current_password'))
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
      'any.required': 'New password is required',
      'any.invalid': 'New password must be different from current password'
    })
});

/**
 * 2FA setup schema
 */
export const setup2FAValidator = Joi.object({}).optional();

/**
 * 2FA enable schema
 */
export const enable2FAValidator = Joi.object({
  totp_code: Joi.string()
    .length(6)
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      'any.required': 'TOTP code is required',
      'string.length': 'TOTP code must be 6 digits',
      'string.pattern.base': 'TOTP code must contain only numbers'
    })
});

/**
 * 2FA disable schema
 */
export const disable2FAValidator = Joi.object({
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required to disable 2FA'
    })
});

/**
 * Validate session schema
 */
export const validateSessionValidator = Joi.object({}).optional();

// Export middleware functions for backward compatibility
export default {
  validateLoginInput,
  validate2FAInput,
  validatePasswordResetRequest,
  validatePasswordReset,
  validateChangePassword
};
