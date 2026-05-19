import Joi from "joi";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

/**
 * Generic validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params', 'headers')
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware function
 */
export const validateRequest = (schema, property = "body", options = {}) => {
  const defaultOptions = {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: false,
    convert: true,
  };

  const validationOptions = { ...defaultOptions, ...options };

  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], validationOptions);

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
      }));

      const apiError = new ApiError(400, "Validation failed", errors);
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Validation failed", errors));
    }

    // Replace the original property with the validated and sanitized value
    req[property] = value;
    next();
  };
};

/**
 * Validate multiple request properties
 * @param {Object} schemas - Object with property names as keys and schemas as values
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware function
 */
export const validateMultiple = (schemas, options = {}) => {
  return (req, res, next) => {
    const errors = [];

    for (const [property, schema] of Object.entries(schemas)) {
      const { error, value } = schema.validate(req[property], {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false,
        convert: true,
        ...options,
      });

      if (error) {
        const propertyErrors = error.details.map((detail) => ({
          property,
          field: detail.path.join("."),
          message: detail.message,
          value: detail.context?.value,
        }));
        errors.push(...propertyErrors);
      } else {
        req[property] = value;
      }
    }

    if (errors.length > 0) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Validation failed", errors));
    }

    next();
  };
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // MongoDB ObjectId validation
  objectId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.pattern.base":
        "Invalid ID format - must be a valid MongoDB ObjectId",
    }),

  // Pagination parameters
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
    offset: Joi.number().integer().min(0).default(0).messages({
      "number.min": "Offset cannot be negative",
    }),
    page: Joi.number().integer().min(1).optional().messages({
      "number.min": "Page number must be at least 1",
    }),
  }),

  // Sorting parameters
  sorting: Joi.object({
    sort_by: Joi.string().optional(),
    sort_order: Joi.string()
      .valid("asc", "desc", "ascending", "descending")
      .default("desc")
      .messages({
        "any.only":
          "Sort order must be one of: asc, desc, ascending, descending",
      }),
  }),

  // Date range validation
  dateRange: Joi.object({
    start_date: Joi.date().iso().optional().messages({
      "date.format":
        "Start date must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
    }),
    end_date: Joi.date().iso().min(Joi.ref("start_date")).optional().messages({
      "date.format":
        "End date must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
      "date.min": "End date must be after start date",
    }),
  }),

  // Search query validation
  search: Joi.object({
    q: Joi.string().min(1).max(200).optional().messages({
      "string.min": "Search query cannot be empty",
      "string.max": "Search query cannot exceed 200 characters",
    }),
    search_fields: Joi.array().items(Joi.string()).optional(),
  }),

  // Email validation
  email: Joi.string()
    .email({ minDomainSegments: 2 })
    .lowercase()
    .trim()
    .messages({
      "string.email": "Please provide a valid email address",
    }),

  // Password validation (strong password)
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(
      new RegExp(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#^()_+\\-=\\[\\]{};:\'\",.&lt;&gt;\\/|`~])[A-Za-z\\d@$!%*?&#^()_+\\-=\\[\\]{};:\'\",.&lt;&gt;\\/|`~]+$"
      )
    )
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.max": "Password must not exceed 128 characters",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    }),

  // URL validation
  url: Joi.string().uri().messages({
    "string.uri": "Please provide a valid URL",
  }),

  // Phone number validation
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .messages({
      "string.pattern.base": "Please provide a valid phone number",
    }),

  // Boolean string conversion
  booleanString: Joi.alternatives().try(
    Joi.boolean(),
    Joi.string()
      .valid("true", "false", "1", "0")
      .custom((value) => {
        return ["true", "1"].includes(value) ? true : false;
      })
  ),

  // File validation
  file: Joi.object({
    fieldname: Joi.string().required(),
    originalname: Joi.string().required(),
    encoding: Joi.string().required(),
    mimetype: Joi.string().required(),
    size: Joi.number()
      .integer()
      .max(10 * 1024 * 1024)
      .messages({
        // 10MB limit
        "number.max": "File size cannot exceed 10MB",
      }),
    buffer: Joi.binary().optional(),
    filename: Joi.string().optional(),
    path: Joi.string().optional(),
  }),
};

/**
 * Parameter validation middleware for route parameters
 * @param {string} paramName - Name of the parameter
 * @param {Object} schema - Joi schema to validate against
 * @returns {Function} Express middleware function
 */
export const validateParam = (paramName, schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params[paramName]);

    if (error) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            `Invalid ${paramName}: ${error.details[0].message}`
          )
        );
    }

    req.params[paramName] = value;
    next();
  };
};

/**
 * ID parameter validation middleware (MongoDB ObjectId)
 */
export const validateId = validateParam(
  "id",
  commonSchemas.objectId.required()
);

/**
 * Query parameter validation with common patterns
 */
export const validateQuery = (additionalSchema = {}) => {
  const baseSchema = Joi.object({
    ...commonSchemas.pagination.describe().keys,
    ...commonSchemas.sorting.describe().keys,
    ...commonSchemas.dateRange.describe().keys,
    ...commonSchemas.search.describe().keys,
    include_deleted: commonSchemas.booleanString.default(false),
    include_inactive: commonSchemas.booleanString.default(false),
    ...additionalSchema,
  });

  return validateRequest(baseSchema, "query");
};

/**
 * File upload validation middleware
 * @param {Object} options - File validation options
 * @returns {Function} Express middleware function
 */
export const validateFileUpload = (options = {}) => {
  const defaultOptions = {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "text/csv",
      "application/json",
    ],
    required: false,
  };

  const config = { ...defaultOptions, ...options };

  return (req, res, next) => {
    if (!req.file && !req.files) {
      if (config.required) {
        return res
          .status(400)
          .json(new ApiResponse(400, null, "File upload is required"));
      }
      return next();
    }

    const files = req.files ? Object.values(req.files).flat() : [req.file];
    const errors = [];

    for (const file of files) {
      if (file.size > config.maxSize) {
        errors.push(
          `File ${file.originalname} exceeds maximum size of ${
            config.maxSize / (1024 * 1024)
          }MB`
        );
      }

      if (!config.allowedMimeTypes.includes(file.mimetype)) {
        errors.push(
          `File ${file.originalname} has unsupported type: ${file.mimetype}`
        );
      }
    }

    if (errors.length > 0) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "File validation failed", errors));
    }

    next();
  };
};

/**
 * Custom validation middleware for complex business logic
 * @param {Function} validatorFunction - Custom validation function
 * @returns {Function} Express middleware function
 */
export const validateCustom = (validatorFunction) => {
  return async (req, res, next) => {
    try {
      const result = await validatorFunction(req);

      if (result !== true) {
        const message =
          typeof result === "string" ? result : "Validation failed";
        const errors = Array.isArray(result) ? result : undefined;

        return res
          .status(400)
          .json(new ApiResponse(400, null, message, errors));
      }

      next();
    } catch (error) {
      console.error("Custom validation error:", error);
      return res
        .status(500)
        .json(new ApiResponse(500, null, "Validation error occurred"));
    }
  };
};

/**
 * Sanitization middleware to clean input data
 * @param {string} property - Request property to sanitize
 * @returns {Function} Express middleware function
 */
export const sanitizeInput = (property = "body") => {
  return (req, res, next) => {
    if (req[property] && typeof req[property] === "object") {
      req[property] = sanitizeObject(req[property]);
    }
    next();
  };
};

/**
 * Recursively sanitize an object
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        // Basic XSS protection
        sanitized[key] = value
          .trim()
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/javascript:/gi, "")
          .replace(/on\w+\s*=/gi, "");
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }

  return obj;
};

// Export all validation utilities
export default {
  validateRequest,
  validateMultiple,
  validateParam,
  validateId,
  validateQuery,
  validateFileUpload,
  validateCustom,
  sanitizeInput,
  commonSchemas,
};
