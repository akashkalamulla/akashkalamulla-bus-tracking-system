const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const { MESSAGES, HTTP_STATUS } = require('../config/constants');

/**
 * Health check endpoint
 * @param {Object} event - Lambda event object
 * @returns {Object} HTTP response
 */
exports.ping = async () => {
  try {
    logger.info('Health check requested');

    const healthData = {
      service: 'bus-tracking-system',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {
        database: 'ok', // TODO: Add actual database health check
        cache: 'ok', // TODO: Add actual cache health check
        api: 'ok',
      },
    };

    return successResponse({
      message: MESSAGES.HEALTH_CHECK_OK,
      data: healthData,
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Health check failed', {
      error: error.message,
    });
  }
};
