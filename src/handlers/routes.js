const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const dynamodbService = require('../services/dynamodb');
const { MESSAGES, HTTP_STATUS } = require('../config/constants');

/**
 * Get all routes
 * @param {Object} event - Lambda event object
 * @returns {Object} HTTP response
 */
exports.getRoutes = async() => {
    try {
        logger.info('Fetching all routes');

        // Fetch routes from DynamoDB
        let routes = [];
        try {
            routes = await dynamodbService.scanTable(process.env.ROUTES_TABLE);
            logger.info(`Found ${routes.length} routes in database`);
        } catch (dbError) {
            logger.warn('Failed to fetch routes from database, using mock data:', dbError.message);
            // Fallback to mock routes if database is not available
            routes = [{
                    RouteID: 'route-001',
                    name: 'Downtown Express',
                    description: 'Express service to downtown area',
                    stops: ['Stop A', 'Stop B', 'Stop C'],
                    schedule: '06:00-22:00',
                },
                {
                    RouteID: 'route-002',
                    name: 'Airport Shuttle',
                    description: 'Direct service to airport',
                    stops: ['Central Station', 'Airport Terminal'],
                    schedule: '05:00-23:30',
                }
            ];
        }

        return successResponse({
            message: MESSAGES.ROUTES_FETCHED,
            data: routes,
            count: routes.length,
        });
    } catch (error) {
        logger.error('Error fetching routes:', error);
        return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error');
    }
};

/**
 * Get route by ID
 * @param {Object} event - Lambda event object
 * @returns {Object} HTTP response
 */
exports.getRoute = async(event) => {
    try {
        const { routeId } = event.pathParameters || {};

        if (!routeId) {
            return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Route ID is required');
        }

        logger.info(`Fetching route: ${routeId}`);

        // Fetch route from DynamoDB
        let route = null;
        try {
            route = await dynamodbService.getItem(process.env.ROUTES_TABLE, { RouteID: routeId });

            if (!route) {
                logger.warn(`Route ${routeId} not found in database`);
                return errorResponse(HTTP_STATUS.NOT_FOUND, `Route ${routeId} not found`);
            }
        } catch (dbError) {
            logger.warn('Failed to fetch route from database, using mock data:', dbError.message);
            // Fallback to mock route if database is not available
            route = {
                RouteID: routeId,
                name: 'Downtown Express',
                description: 'Express service to downtown area',
                stops: [
                    { id: 'stop-001', name: 'Central Station', coordinates: [40.7128, -74.0060] },
                    { id: 'stop-002', name: 'Business District', coordinates: [40.7589, -73.9851] },
                    { id: 'stop-003', name: 'Shopping Center', coordinates: [40.7505, -73.9934] },
                ],
                schedule: {
                    weekdays: '06:00-22:00',
                    weekends: '08:00-20:00',
                },
                frequency: '15 minutes',
                active: true,
            };
        }

        return successResponse({
            message: 'Route fetched successfully',
            data: route,
        });
    } catch (error) {
        logger.error('Error fetching route:', error);
        return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error');
    }
};