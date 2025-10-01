/**
 * Application constants
 */

module.exports = {
  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  },

  // DynamoDB Table Names (populated from environment)
  TABLES: {
    ROUTES: process.env.ROUTES_TABLE,
    BUSES: process.env.BUSES_TABLE,
    LOCATIONS: process.env.LOCATIONS_TABLE,
  },

  // Redis Configuration
  REDIS: {
    HOST: process.env.REDIS_HOST || 'localhost',
    PORT: parseInt(process.env.REDIS_PORT, 10) || 6379,
    TTL: {
      ROUTE_CACHE: 300, // 5 minutes
      LOCATION_CACHE: 30, // 30 seconds
    },
  },

  // Location tracking constants
  LOCATION: {
    MAX_SPEED_KMH: 100, // Maximum allowed speed for buses
    UPDATE_INTERVAL_SECONDS: 30,
    GEOHASH_PRECISION: 7,
  },

  // API Response messages
  MESSAGES: {
    ROUTE_NOT_FOUND: 'Route not found',
    BUS_NOT_FOUND: 'Bus not found',
    INVALID_LOCATION: 'Invalid location data',
    LOCATION_UPDATED: 'Location updated successfully',
    ROUTES_FETCHED: 'Routes fetched successfully',
    HEALTH_CHECK_OK: 'Service is healthy',
  },
};
