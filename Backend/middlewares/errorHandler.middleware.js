import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

/**
 * Global error handling middleware
 * Must be placed after all routes and other middleware
 */
export const globalErrorHandler = (error, req, res, next) => {
  let err = { ...error };
  err.message = error.message;

  // Log error details
  console.error("Error:", {
    name: error.name,
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    user: req.user?.id || "anonymous",
    timestamp: new Date().toISOString(),
  });

  // Mongoose bad ObjectId
  if (error.name === "CastError") {
    const message = "Invalid resource ID format";
    err = new ApiError(400, message);
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const message = `Duplicate value for field: ${field}`;
    err = new ApiError(409, message);
  }

  // Mongoose validation error
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    err = new ApiError(400, "Validation failed", errors);
  }

  // JWT errors
  if (error.name === "JsonWebTokenError") {
    const message = "Invalid authentication token";
    err = new ApiError(401, message);
  }

  if (error.name === "TokenExpiredError") {
    const message = "Authentication token has expired";
    err = new ApiError(401, message);
  }

  // Database connection errors
  if (error.name === "MongoServerError") {
    const message = "Database operation failed";
    err = new ApiError(503, message);
  }

  // Handle ApiError instances
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json(new ApiResponse(err.statusCode, null, err.message, err.errors));
  }

  // Default to 500 server error
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // SECURITY FIX (PATCH 41): Don't expose internal error details in UAT/production
  // Use explicit EXPOSE_ERROR_DETAILS flag instead of NODE_ENV
  // This prevents CWE-209 (Information Exposure Through Error Messages)
  const shouldExposeDetails = process.env.EXPOSE_ERROR_DETAILS === 'true';

  const errorResponse = shouldExposeDetails
    ? new ApiResponse(statusCode, null, message, {
        stack: error.stack,
        name: error.name,
      })
    : new ApiResponse(statusCode, null, message);

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  const error = new ApiError(404, message);
  next(error);
};

/**
 * Async error handler wrapper
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default {
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
};
