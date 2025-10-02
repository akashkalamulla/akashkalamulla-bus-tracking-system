const { v4: uuidv4 } = require('uuid');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const dynamodbService = require('../services/dynamodb');
const { MESSAGES, HTTP_STATUS } = require('../config/constants');
const { parseAndValidateBody } = require('../utils/request-parser');

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

    logger.info(`Updating location for bus ${busId}:`, { latitude, longitude, timestamp });

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
      logger.info(`Location stored successfully for bus ${busId}`);
    } catch (dbError) {
      logger.error('Failed to store location in database:', dbError);
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
    logger.error('Error updating location:', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
};
