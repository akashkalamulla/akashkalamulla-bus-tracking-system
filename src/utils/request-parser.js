const logger = require('./logger');
const { errorResponse } = require('./response');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Safely parse JSON request body with comprehensive error handling
 * @param {Object} event - Lambda event object
 * @returns {Object} Parsed body or error response
 */
const parseRequestBody = (event) => {
  // Check if body exists
  if (!event.body) {
    logger.warn('Request body is empty');
    return {
      success: false,
      error: errorResponse(HTTP_STATUS.BAD_REQUEST, 'Request body is required'),
    };
  }

  // Handle different body types
  try {
    // If body is already an object (common in testing or local invocation)
    if (typeof event.body === 'object' && event.body !== null) {
      logger.debug('Request body is already an object');
      return {
        success: true,
        data: event.body,
      };
    }

    // If body is a string, attempt to parse it as JSON
    if (typeof event.body === 'string') {
      // Check for empty string
      if (event.body.trim() === '') {
        logger.warn('Request body is an empty string');
        return {
          success: false,
          error: errorResponse(HTTP_STATUS.BAD_REQUEST, 'Request body cannot be empty'),
        };
      }

      // Attempt JSON parsing with detailed error handling
      try {
        const parsed = JSON.parse(event.body);
        logger.debug('Successfully parsed JSON request body');
        return {
          success: true,
          data: parsed,
        };
      } catch (jsonError) {
        // Log parsing error with safe substring to avoid huge logs
        const bodySample = event.body.substring(0, 100);
        logger.error('Invalid JSON in request body', {
          error: jsonError.message,
          bodySample,
          bodyLength: event.body.length,
          bodyType: typeof event.body,
        });

        return {
          success: false,
          error: errorResponse(
            HTTP_STATUS.BAD_REQUEST,
            'Invalid JSON format in request body',
          ),
        };
      }
    }

    // Unsupported body type
    logger.error('Unsupported request body type', {
      bodyType: typeof event.body,
      bodyConstructor: event.body?.constructor?.name,
    });

    return {
      success: false,
      error: errorResponse(
        HTTP_STATUS.BAD_REQUEST,
        'Unsupported request body format',
      ),
    };
  } catch (unexpectedError) {
    // Catch any unexpected errors during parsing
    logger.error('Unexpected error parsing request body', {
      error: unexpectedError.message,
      stack: unexpectedError.stack,
      bodyType: typeof event.body,
    });

    return {
      success: false,
      error: errorResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Failed to process request body',
      ),
    };
  }
};

/**
 * Validate that parsed body contains required fields
 * @param {Object} body - Parsed request body
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Object} Validation result
 */
const validateRequiredFields = (body, requiredFields) => {
  const missingFields = requiredFields.filter((field) => !(field in body));

  if (missingFields.length > 0) {
    logger.warn('Missing required fields in request body', {
      missingFields,
      receivedFields: Object.keys(body),
    });

    return {
      valid: false,
      error: errorResponse(
        HTTP_STATUS.BAD_REQUEST,
        `Missing required fields: ${missingFields.join(', ')}`,
      ),
    };
  }

  return { valid: true };
};

/**
 * Parse and validate request body in one step
 * @param {Object} event - Lambda event object
 * @param {string[]} requiredFields - Array of required field names (optional)
 * @returns {Object} Parse and validation result
 */
const parseAndValidateBody = (event, requiredFields = []) => {
  // First parse the body
  const parseResult = parseRequestBody(event);

  if (!parseResult.success) {
    return parseResult;
  }

  // If required fields specified, validate them
  if (requiredFields.length > 0) {
    const validationResult = validateRequiredFields(parseResult.data, requiredFields);

    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error,
      };
    }
  }

  return {
    success: true,
    data: parseResult.data,
  };
};

module.exports = {
  parseRequestBody,
  validateRequiredFields,
  parseAndValidateBody,
};
