/**
 * Utility for sending sanitized error responses to clients
 * Prevents system information leakage while providing useful feedback
 */

/**
 * Send a sanitized error response to the client
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} userMessage - User-friendly error message
 * @param {Error} error - Original error object (for logging/debugging only)
 */
export const sendErrorResponse = (res, statusCode, userMessage, error = null) => {
  // Log the full error server-side for debugging
  if (error) {
    console.error(`[Error ${statusCode}]:`, error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack trace:', error.stack);
    }
  }

  // Send sanitized response to client
  const response = {
    success: false,
    message: userMessage,
  };

  // Only include debug information in development mode
  if (process.env.NODE_ENV === 'development' && error) {
    response.debug = {
      error: error.message,
      stack: error.stack,
    };
  }

  res.status(statusCode).json(response);
};

/**
 * Get a user-friendly message based on error type
 * @param {Error} error - Error object
 * @param {string} defaultMessage - Default message if no specific match
 * @returns {Object} - { statusCode, message }
 */
export const categorizeError = (error, defaultMessage = 'An error occurred. Please try again later.') => {
  const errorMessage = error.message || '';

  // Connection errors
  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
    return {
      statusCode: 503,
      message: 'Service temporarily unavailable. Please try again later.',
    };
  }

  // Authentication errors
  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Authentication failed')) {
    return {
      statusCode: 401,
      message: 'Authentication failed. Please contact your administrator.',
    };
  }

  // Permission errors
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('not authorized')) {
    return {
      statusCode: 403,
      message: 'You do not have permission to perform this action.',
    };
  }

  // Not found errors
  if (errorMessage.includes('404') || errorMessage.includes('Not found')) {
    return {
      statusCode: 404,
      message: 'The requested resource was not found.',
    };
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    return {
      statusCode: 504,
      message: 'Request timed out. The service may be experiencing high load.',
    };
  }

  // Validation errors
  if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
    return {
      statusCode: 400,
      message: 'Invalid request. Please check your input and try again.',
    };
  }

  // Default server error
  return {
    statusCode: 500,
    message: defaultMessage,
  };
};

/**
 * Send a smart error response that automatically categorizes the error
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 * @param {string} defaultMessage - Default user message
 */
export const sendSmartErrorResponse = (res, error, defaultMessage) => {
  const { statusCode, message } = categorizeError(error, defaultMessage);
  sendErrorResponse(res, statusCode, message, error);
};

export default {
  sendErrorResponse,
  categorizeError,
  sendSmartErrorResponse,
};
