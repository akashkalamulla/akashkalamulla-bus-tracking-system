const { v4: uuidv4 } = require('uuid');
const { successResponse, errorResponse } = require('../utils/response');
const {
  error: logError, warn: logWarn, info: logInfo, debug: logDebug,
} = require('../utils/logger');
const dynamodbService = require('../services/dynamodb');
const redisService = require('../services/redis-service');
const { MESSAGES, HTTP_STATUS } = require('../config/constants');
const { parseAndValidateBody } = require('../utils/request-parser');
// const redisService = require('../services/redis-service');
// const { withRateLimit } = require('../utils/rate-limiter'); // DISABLED FOR PRODUCTION

// Helper function to safely use Redis - fails gracefully if Redis unavailable
async function safeRedisOperation(operation, ...args) {
  try {
    return await redisService[operation](...args);
  } catch (error) {
    logWarn(`Redis operation ${operation} failed, continuing without cache`, { error: error.message });
    return null;
  }
}

/**
 * Update bus location
 * @param {Object} event - Lambda event object
 * @returns {Object} HTTP response
 */
exports.updateLocation = async (event) => {
  try {
    const { busId } = event.pathParameters || {};

    if (!busId) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Bus ID is required');
    }

    // Parse request body using the new utility
    const parseResult = parseAndValidateBody(event, ['latitude', 'longitude']);

    if (!parseResult.success) {
      return parseResult.error;
    }

    const body = parseResult.data;

    const {
      latitude,
      longitude,
      timestamp,
      speed,
      heading,
    } = body;

    // Basic validation
    if (!latitude || !longitude) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Latitude and longitude are required');
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Latitude and longitude must be numbers');
    }

    if (latitude < -90 || latitude > 90) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Latitude must be between -90 and 90');
    }

    if (longitude < -180 || longitude > 180) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Longitude must be between -180 and 180');
    }

    logInfo(`Updating location for bus ${busId}:`, { latitude, longitude, timestamp });

    // Create location data
    const locationData = {
      BusID: busId,
      timestamp: timestamp || new Date().toISOString(),
      locationId: uuidv4(),
      latitude,
      longitude,
      speed: speed || 0,
      heading: heading || 0,
      ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours TTL
      createdAt: new Date().toISOString(),
    };

    try {
      // Store location in DynamoDB
      await dynamodbService.putItem(process.env.LOCATIONS_TABLE, locationData);
      logInfo(`Location stored successfully for bus ${busId}`);

      // Cache the latest location in Redis with 5 minutes TTL
      const cacheKey = `bus:${busId}:location`;
      const cacheData = {
        latitude,
        longitude,
        timestamp: locationData.timestamp,
        speed: speed || 0,
        heading: heading || 0,
        updatedAt: new Date().toISOString(),
      };

      // Safe Redis caching - won't fail if Redis unavailable
      await safeRedisOperation('set', cacheKey, JSON.stringify(cacheData), 300); // 5 minutes TTL
      logInfo(`Location cached successfully for bus ${busId}`, { cacheKey });
    } catch (dbError) {
      logError('Failed to store location in database:', dbError);
      return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to store location data');
    }

    const responseData = {
      busId,
      location: {
        latitude,
        longitude,
        timestamp: timestamp || new Date().toISOString(),
        speed: speed || 0,
        heading: heading || 0,
      },
      updated: true,
    };

    return successResponse({
      message: MESSAGES.LOCATION_UPDATED,
      data: responseData,
    });
  } catch (error) {
    logError('Error updating location:', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
};

/**
 * Get latest bus location (from cache first, then database)
 * @param {Object} event - Lambda event object
 * @returns {Object} HTTP response
 */
exports.getLocation = async (event) => {
  try {
    const { busId } = event.pathParameters || {};

    if (!busId) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Bus ID is required');
    }

    logInfo(`Getting location for bus ${busId}`);

    // Try to get from cache first
    const cacheKey = `bus:${busId}:location`;
    // Try cache first (safe operation)
    const cachedLocation = await safeRedisOperation('get', cacheKey);

    if (cachedLocation) {
      logInfo(`Location found in cache for bus ${busId}`);
      const locationData = JSON.parse(cachedLocation);

      return successResponse({
        message: 'Location retrieved successfully',
        data: {
          busId,
          location: locationData,
          source: 'cache',
        },
      });
    }

    // If not in cache, get from database
    logInfo(`Location not in cache, querying database for bus ${busId}`);

    try {
      // Query DynamoDB for latest location using the service's queryTable helper
      const queryParams = {
        KeyConditionExpression: 'BusID = :busId',
        ExpressionAttributeValues: {
          ':busId': busId,
        },
        ScanIndexForward: false, // Get latest first
        Limit: 1,
      };

      // queryTable returns an array of items
      const items = await dynamodbService.queryTable(process.env.LOCATIONS_TABLE, queryParams);

      if (!items || items.length === 0) {
        return errorResponse(HTTP_STATUS.NOT_FOUND, `No location data found for bus ${busId}`);
      }

      const latestLocation = items[0];
      const locationData = {
        latitude: latestLocation.latitude,
        longitude: latestLocation.longitude,
        timestamp: latestLocation.timestamp,
        speed: latestLocation.speed || 0,
        heading: latestLocation.heading || 0,
        updatedAt: latestLocation.createdAt,
      };

      // Safe Redis caching - won't fail if Redis unavailable
      await safeRedisOperation('set', cacheKey, JSON.stringify(locationData), 300); // 5 minutes TTL
      logInfo(`Location cached from database for bus ${busId}`);

      return successResponse({
        message: 'Location retrieved successfully',
        data: {
          busId,
          location: locationData,
          source: 'database',
        },
      });
    } catch (dbError) {
      logError('Failed to get location from database:', dbError);
      return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to retrieve location data');
    }
  } catch (error) {
    logError('Error getting location:', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
};

// Wrap exports with rate limiting
const originalUpdateLocation = exports.updateLocation;
const originalGetLocation = exports.getLocation;

// PRODUCTION: Rate limiting disabled for reliability
// exports.updateLocation = withRateLimit(originalUpdateLocation, 'OPERATOR');
// exports.getLocation = withRateLimit(originalGetLocation, 'OPERATOR');
exports.updateLocation = originalUpdateLocation;
exports.getLocation = originalGetLocation;
