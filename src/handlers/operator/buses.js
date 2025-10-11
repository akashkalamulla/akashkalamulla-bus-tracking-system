const AWS = require('aws-sdk');
const Redis = require('ioredis');
const { getUserContext } = require('../auth');
const { logger } = require('../../utils/logger');
const { successResponse, errorResponse } = require('../../utils/response');
const { withRateLimit } = require('../../utils/rate-limiter');

// Initialize services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
  retryDelayOnFailure: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

const BUSES_TABLE = process.env.BUSES_TABLE || 'Buses';
const LOCATIONS_TABLE = process.env.LOCATIONS_TABLE || 'BusLocations';
const CACHE_TTL = 300; // 5 minutes

/**
 * Validates bus data for create/update operations
 */
function validateBusData(busData, isUpdate = false) {
  const errors = [];
  
  if (!isUpdate && !busData.busNumber) {
    errors.push('Bus number is required');
  }
  
  if (busData.busNumber && typeof busData.busNumber !== 'string') {
    errors.push('Bus number must be a string');
  }
  
  if (busData.capacity && (!Number.isInteger(busData.capacity) || busData.capacity <= 0)) {
    errors.push('Capacity must be a positive integer');
  }
  
  if (busData.routeId && typeof busData.routeId !== 'string') {
    errors.push('Route ID must be a string');
  }
  
  if (busData.status && !['ACTIVE', 'INACTIVE', 'MAINTENANCE'].includes(busData.status)) {
    errors.push('Status must be one of: ACTIVE, INACTIVE, MAINTENANCE');
  }
  
  return errors;
}

/**
 * Validates location data for updates
 */
function validateLocationData(locationData) {
  const errors = [];
  
  if (typeof locationData.latitude !== 'number' || locationData.latitude < -90 || locationData.latitude > 90) {
    errors.push('Latitude must be a number between -90 and 90');
  }
  
  if (typeof locationData.longitude !== 'number' || locationData.longitude < -180 || locationData.longitude > 180) {
    errors.push('Longitude must be a number between -180 and 180');
  }
  
  if (locationData.heading !== undefined && (typeof locationData.heading !== 'number' || locationData.heading < 0 || locationData.heading >= 360)) {
    errors.push('Heading must be a number between 0 and 359');
  }
  
  if (locationData.speed !== undefined && (typeof locationData.speed !== 'number' || locationData.speed < 0)) {
    errors.push('Speed must be a non-negative number');
  }
  
  return errors;
}

/**
 * Checks if the operator owns the specified bus
 */
async function validateBusOwnership(busId, operatorId) {
  try {
    const params = {
      TableName: BUSES_TABLE,
      Key: { BusID: busId },
      ProjectionExpression: 'OperatorID'
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
      return { valid: false, notFound: true };
    }
    
    if (result.Item.OperatorID !== operatorId) {
      return { valid: false, notFound: false };
    }
    
    return { valid: true, notFound: false };
  } catch (error) {
    logger.error('Error validating bus ownership:', error);
    throw error;
  }
}

/**
 * Invalidates bus-related cache entries
 */
async function invalidateBusCache(busId, operatorId) {
  try {
    const cacheKeys = [
      `operator:buses:${operatorId}`,
      `operator:bus:${busId}`,
      `bus:location:${busId}`,
      'buses:all',
      `buses:live:*`
    ];
    
    await redis.del(...cacheKeys);
    logger.info(`Invalidated cache for bus ${busId}`);
  } catch (error) {
    logger.warn('Failed to invalidate cache:', error);
  }
}

/**
 * Logs operator actions for audit trail
 */
function logOperatorAction(operatorId, action, busId, details = {}) {
  logger.info('Operator action', {
    operatorId,
    action,
    busId,
    timestamp: new Date().toISOString(),
    ...details
  });
}

/**
 * GET /operator/buses
 * Get all buses owned by the operator
 */
async function getBuses(event) {
  try {
    const userContext = getUserContext(event);
    const operatorId = userContext.operatorId;
    
    // Check cache first
    const cacheKey = `operator:buses:${operatorId}`;
    let buses = await redis.get(cacheKey);
    
    if (buses) {
      logger.info(`Cache hit for operator buses: ${operatorId}`);
      return successResponse(JSON.parse(buses));
    }
    
    // Query DynamoDB for operator's buses
    const params = {
      TableName: BUSES_TABLE,
      IndexName: 'OperatorIndex',
      KeyConditionExpression: 'OperatorID = :operatorId',
      ExpressionAttributeValues: {
        ':operatorId': operatorId
      }
    };
    
    const result = await dynamodb.query(params).promise();
    
    // Cache the results
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result.Items));
    
    logOperatorAction(operatorId, 'GET_BUSES', null, { count: result.Items.length });
    
    return successResponse(result.Items);
    
  } catch (error) {
    logger.error('Error getting operator buses:', error);
    return errorResponse(500, 'Failed to retrieve buses');
  }
}

/**
 * GET /operator/buses/{busId}
 * Get specific bus details (ownership validated)
 */
async function getBus(event) {
  try {
    const userContext = getUserContext(event);
    const operatorId = userContext.operatorId;
    const busId = event.pathParameters.busId;
    
    // Validate ownership
    const ownership = await validateBusOwnership(busId, operatorId);
    if (!ownership.valid) {
      if (ownership.notFound) {
        return errorResponse(404, 'Bus not found');
      }
      return errorResponse(403, 'Access denied: You can only access your own buses');
    }
    
    // Check cache first
    const cacheKey = `operator:bus:${busId}`;
    let bus = await redis.get(cacheKey);
    
    if (bus) {
      logger.info(`Cache hit for bus: ${busId}`);
      return successResponse(JSON.parse(bus));
    }
    
    // Get from DynamoDB
    const params = {
      TableName: BUSES_TABLE,
      Key: { BusID: busId }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
      return errorResponse(404, 'Bus not found');
    }
    
    // Cache the result
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result.Item));
    
    logOperatorAction(operatorId, 'GET_BUS', busId);
    
    return successResponse(result.Item);
    
  } catch (error) {
    logger.error('Error getting bus:', error);
    return errorResponse(500, 'Failed to retrieve bus');
  }
}

/**
 * POST /operator/buses
 * Create a new bus for the operator
 */
async function createBus(event) {
  try {
    const userContext = getUserContext(event);
    const operatorId = userContext.operatorId;
    const busData = JSON.parse(event.body);
    
    // Validate input data
    const validationErrors = validateBusData(busData);
    if (validationErrors.length > 0) {
      return errorResponse(400, 'Validation failed', { errors: validationErrors });
    }
    
    // Check if bus number already exists for this operator
    // Note: Using scan for now, will optimize with OperatorBusNumberIndex in future update
    const existingBusParams = {
      TableName: BUSES_TABLE,
      FilterExpression: 'OperatorID = :operatorId AND BusNumber = :busNumber',
      ExpressionAttributeValues: {
        ':operatorId': operatorId,
        ':busNumber': busData.busNumber
      }
    };
    
    const existingBus = await dynamodb.scan(existingBusParams).promise();
    if (existingBus.Items.length > 0) {
      return errorResponse(409, 'Bus number already exists for your operator');
    }
    
    // Create new bus
    const busId = `bus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    const newBus = {
      BusID: busId,
      OperatorID: operatorId,
      BusNumber: busData.busNumber,
      Capacity: busData.capacity || 50,
      RouteID: busData.routeId,
      Status: busData.status || 'ACTIVE',
      Model: busData.model,
      Year: busData.year,
      CreatedAt: timestamp,
      UpdatedAt: timestamp
    };
    
    const params = {
      TableName: BUSES_TABLE,
      Item: newBus,
      ConditionExpression: 'attribute_not_exists(BusID)'
    };
    
    await dynamodb.put(params).promise();
    
    // Invalidate cache
    await invalidateBusCache(busId, operatorId);
    
    logOperatorAction(operatorId, 'CREATE_BUS', busId, { busNumber: busData.busNumber });
    
    return successResponse(newBus, 201);
    
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return errorResponse(409, 'Bus ID already exists');
    }
    logger.error('Error creating bus:', error);
    return errorResponse(500, 'Failed to create bus');
  }
}

/**
 * PUT /operator/buses/{busId}
 * Update bus details (ownership validated)
 */
async function updateBus(event) {
  try {
    const userContext = getUserContext(event);
    const operatorId = userContext.operatorId;
    const busId = event.pathParameters.busId;
    const updateData = JSON.parse(event.body);
    
    // Validate ownership
    const ownership = await validateBusOwnership(busId, operatorId);
    if (!ownership.valid) {
      if (ownership.notFound) {
        return errorResponse(404, 'Bus not found');
      }
      return errorResponse(403, 'Access denied: You can only modify your own buses');
    }
    
    // Validate input data
    const validationErrors = validateBusData(updateData, true);
    if (validationErrors.length > 0) {
      return errorResponse(400, 'Validation failed', { errors: validationErrors });
    }
    
    // Build update expression
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};
    
    if (updateData.capacity !== undefined) {
      updateExpression.push('Capacity = :capacity');
      expressionAttributeValues[':capacity'] = updateData.capacity;
    }
    
    if (updateData.routeId !== undefined) {
      updateExpression.push('RouteID = :routeId');
      expressionAttributeValues[':routeId'] = updateData.routeId;
    }
    
    if (updateData.status !== undefined) {
      updateExpression.push('#status = :status');
      expressionAttributeNames['#status'] = 'Status';
      expressionAttributeValues[':status'] = updateData.status;
    }
    
    if (updateData.model !== undefined) {
      updateExpression.push('Model = :model');
      expressionAttributeValues[':model'] = updateData.model;
    }
    
    if (updateData.year !== undefined) {
      updateExpression.push('#year = :year');
      expressionAttributeNames['#year'] = 'Year';
      expressionAttributeValues[':year'] = updateData.year;
    }
    
    updateExpression.push('UpdatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    
    if (updateExpression.length === 1) { // Only updatedAt
      return errorResponse(400, 'No valid fields to update');
    }
    
    const params = {
      TableName: BUSES_TABLE,
      Key: { BusID: busId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamodb.update(params).promise();
    
    // Invalidate cache
    await invalidateBusCache(busId, operatorId);
    
    logOperatorAction(operatorId, 'UPDATE_BUS', busId, { updates: Object.keys(updateData) });
    
    return successResponse(result.Attributes);
    
  } catch (error) {
    logger.error('Error updating bus:', error);
    return errorResponse(500, 'Failed to update bus');
  }
}

/**
 * DELETE /operator/buses/{busId}
 * Delete bus (ownership validated)
 */
async function deleteBus(event) {
  try {
    const userContext = getUserContext(event);
    const operatorId = userContext.operatorId;
    const busId = event.pathParameters.busId;
    
    // Validate ownership
    const ownership = await validateBusOwnership(busId, operatorId);
    if (!ownership.valid) {
      if (ownership.notFound) {
        return errorResponse(404, 'Bus not found');
      }
      return errorResponse(403, 'Access denied: You can only delete your own buses');
    }
    
    const params = {
      TableName: BUSES_TABLE,
      Key: { BusID: busId },
      ConditionExpression: 'attribute_exists(BusID)'
    };
    
    await dynamodb.delete(params).promise();
    
    // Invalidate cache
    await invalidateBusCache(busId, operatorId);
    
    logOperatorAction(operatorId, 'DELETE_BUS', busId);
    
    return successResponse({ message: 'Bus deleted successfully' });
    
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return errorResponse(404, 'Bus not found');
    }
    logger.error('Error deleting bus:', error);
    return errorResponse(500, 'Failed to delete bus');
  }
}

/**
 * PUT /operator/buses/{busId}/location
 * Update bus location with timestamp validation (ownership validated)
 */
async function updateLocation(event) {
  try {
    const userContext = getUserContext(event);
    const operatorId = userContext.operatorId;
    const busId = event.pathParameters.busId;
    const locationData = JSON.parse(event.body);
    
    // Validate ownership
    const ownership = await validateBusOwnership(busId, operatorId);
    if (!ownership.valid) {
      if (ownership.notFound) {
        return errorResponse(404, 'Bus not found');
      }
      return errorResponse(403, 'Access denied: You can only update locations for your own buses');
    }
    
    // Validate location data
    const validationErrors = validateLocationData(locationData);
    if (validationErrors.length > 0) {
      return errorResponse(400, 'Validation failed', { errors: validationErrors });
    }
    
    const currentTimestamp = new Date().toISOString();
    const providedTimestamp = locationData.timestamp || currentTimestamp;
    
    // Validate timestamp (not more than 5 minutes old or in the future)
    const timestampDate = new Date(providedTimestamp);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    if (timestampDate > now || timestampDate < fiveMinutesAgo) {
      return errorResponse(400, 'Invalid timestamp: must be within the last 5 minutes');
    }
    
    // Create location record
    const locationRecord = {
      BusID: busId,
      timestamp: providedTimestamp,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      heading: locationData.heading || 0,
      speed: locationData.speed || 0,
      accuracy: locationData.accuracy,
      OperatorID: operatorId,
      ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours TTL
    };
    
    // Save to locations table
    const locationParams = {
      TableName: LOCATIONS_TABLE,
      Item: locationRecord
    };
    
    await dynamodb.put(locationParams).promise();
    
    // Update bus's last known location
    const busUpdateParams = {
      TableName: BUSES_TABLE,
      Key: { BusID: busId },
      UpdateExpression: 'SET LastLocation = :location, LastLocationUpdate = :timestamp',
      ExpressionAttributeValues: {
        ':location': {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          heading: locationData.heading || 0,
          speed: locationData.speed || 0
        },
        ':timestamp': providedTimestamp
      }
    };
    
    await dynamodb.update(busUpdateParams).promise();
    
    // Update Redis cache for real-time data
    const realTimeCacheKey = `bus:location:${busId}`;
    await redis.setex(realTimeCacheKey, 60, JSON.stringify(locationRecord)); // 1 minute TTL for real-time data
    
    // Invalidate other caches
    await invalidateBusCache(busId, operatorId);
    
    logOperatorAction(operatorId, 'UPDATE_LOCATION', busId, {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      timestamp: providedTimestamp
    });
    
    return successResponse({
      message: 'Location updated successfully',
      timestamp: providedTimestamp,
      location: locationRecord
    });
    
  } catch (error) {
    logger.error('Error updating location:', error);
    return errorResponse(500, 'Failed to update location');
  }
}

/**
 * GET /operator/buses/{busId}/location
 * Get current location of bus (ownership validated)
 */
async function getLocation(event) {
  try {
    const userContext = getUserContext(event);
    const operatorId = userContext.operatorId;
    const busId = event.pathParameters.busId;
    
    // Validate ownership
    const ownership = await validateBusOwnership(busId, operatorId);
    if (!ownership.valid) {
      if (ownership.notFound) {
        return errorResponse(404, 'Bus not found');
      }
      return errorResponse(403, 'Access denied: You can only access locations for your own buses');
    }
    
    // Check real-time cache first
    const cacheKey = `bus:location:${busId}`;
    let location = await redis.get(cacheKey);
    
    if (location) {
      logger.info(`Cache hit for bus location: ${busId}`);
      return successResponse(JSON.parse(location));
    }
    
    // Get latest location from DynamoDB
    const params = {
      TableName: LOCATIONS_TABLE,
      KeyConditionExpression: 'BusID = :busId',
      ExpressionAttributeValues: {
        ':busId': busId
      },
      ScanIndexForward: false, // Get latest first
      Limit: 1
    };
    
    const result = await dynamodb.query(params).promise();
    
    if (result.Items.length === 0) {
      return errorResponse(404, 'No location data found for this bus');
    }
    
    const latestLocation = result.Items[0];
    
    // Cache for 30 seconds
    await redis.setex(cacheKey, 30, JSON.stringify(latestLocation));
    
    logOperatorAction(operatorId, 'GET_LOCATION', busId);
    
    return successResponse(latestLocation);
    
  } catch (error) {
    logger.error('Error getting location:', error);
    return errorResponse(500, 'Failed to retrieve location');
  }
}

module.exports = {
  getBuses: withRateLimit(getBuses, 'OPERATOR'),
  getBus: withRateLimit(getBus, 'OPERATOR'),
  createBus: withRateLimit(createBus, 'OPERATOR'),
  updateBus: withRateLimit(updateBus, 'OPERATOR'),
  deleteBus: withRateLimit(deleteBus, 'OPERATOR'),
  updateLocation: withRateLimit(updateLocation, 'OPERATOR'),
  getLocation: withRateLimit(getLocation, 'OPERATOR')
};