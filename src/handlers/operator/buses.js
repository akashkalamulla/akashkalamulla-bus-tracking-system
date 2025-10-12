const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
// const Redis = require('ioredis');
const { getUserContext } = require('../auth');
const { error: logError, warn: logWarn, info: logInfo, debug: logDebug } = require('../../utils/logger');
const { successResponse, errorResponse } = require('../../utils/response');
// const { withRateLimit } = require('../../utils/rate-limiter');

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

// Disable Redis temporarily
// const redis = new Redis({
//   host: process.env.REDIS_HOST,
//   port: process.env.REDIS_PORT || 6379,
//   retryDelayOnFailure: 100,
//   maxRetriesPerRequest: 3,
//   lazyConnect: true
// });

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
    
    const result = await dynamodb.send(new GetCommand(params));
    
    if (!result.Item) {
      return { valid: false, notFound: true };
    }
    
    if (result.Item.OperatorID !== operatorId) {
      return { valid: false, notFound: false };
    }
    
    return { valid: true, notFound: false };
  } catch (error) {
    logError('Error validating bus ownership:', error);
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
    
    // await redis.del(...cacheKeys); // Redis temporarily disabled
    logInfo(`Invalidated cache for bus ${busId}`);
  } catch (error) {
    logger.warn('Failed to invalidate cache:', error);
  }
}

/**
 * Logs operator actions for audit trail
 */
function logOperatorAction(operatorId, action, busId, details = {}) {
  logInfo('Operator action', {
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
    
    // Check cache first - Redis temporarily disabled
    // const cacheKey = `operator:buses:${operatorId}`;
    // let buses = await redis.get(cacheKey);
    
    // if (buses) {
    //   logInfo(`Cache hit for operator buses: ${operatorId}`);
    //   return successResponse(JSON.parse(buses));
    // }
    
    // Query DynamoDB for operator's buses
    const params = {
      TableName: BUSES_TABLE,
      IndexName: 'OperatorIndex',
      KeyConditionExpression: 'OperatorID = :operatorId',
      ExpressionAttributeValues: {
        ':operatorId': operatorId
      }
    };
    
    const result = await dynamodb.send(new QueryCommand(params));
    
    // Cache the results - Redis temporarily disabled
    // await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result.Items));
    
    logOperatorAction(operatorId, 'GET_BUSES', null, { count: result.Items.length });
    
    return successResponse(result.Items);
    
  } catch (error) {
    logError('Error getting operator buses:', error);
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
    
    // Check cache first - Redis temporarily disabled
    // const cacheKey = `operator:bus:${busId}`;
    // let bus = await redis.get(cacheKey);
    
    // if (bus) {
    //   logInfo(`Cache hit for bus: ${busId}`);
    //   return successResponse(JSON.parse(bus));
    // }
    
    // Get from DynamoDB
    const params = {
      TableName: BUSES_TABLE,
      Key: { BusID: busId }
    };
    
    const result = await dynamodb.send(new GetCommand(params));
    
    if (!result.Item) {
      return errorResponse(404, 'Bus not found');
    }
    
    // Cache the result - Redis temporarily disabled
    // await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result.Item));
    
    logOperatorAction(operatorId, 'GET_BUS', busId);
    
    return successResponse(result.Item);
    
  } catch (error) {
    logError('Error getting bus:', error);
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
    
    const existingBus = await dynamodb.send(new ScanCommand(existingBusParams));
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
    
    await dynamodb.send(new PutCommand(params));
    
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
    
    const result = await dynamodb.send(new UpdateCommand(params));
    
    // Invalidate cache
    await invalidateBusCache(busId, operatorId);
    
    logOperatorAction(operatorId, 'UPDATE_BUS', busId, { updates: Object.keys(updateData) });
    
    return successResponse(result.Attributes);
    
  } catch (error) {
    logError('Error updating bus:', error);
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
    
    await dynamodb.send(new DeleteCommand(params));
    
    // Invalidate cache
    await invalidateBusCache(busId, operatorId);
    
    logOperatorAction(operatorId, 'DELETE_BUS', busId);
    
    return successResponse({ message: 'Bus deleted successfully' });
    
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return errorResponse(404, 'Bus not found');
    }
    logError('Error deleting bus:', error);
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
    
    await dynamodb.send(new PutCommand(locationParams));
    
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
    
    await dynamodb.send(new UpdateCommand(busUpdateParams));
    
    // Update Redis cache for real-time data
    const realTimeCacheKey = `bus:location:${busId}`;
    // await redis.setex(realTimeCacheKey, 60, JSON.stringify(locationRecord)); // Redis temporarily disabled
    
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
    logError('Error updating location:', error);
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
    
    // Check real-time cache first - Redis temporarily disabled
    // const cacheKey = `bus:location:${busId}`;
    // let location = await redis.get(cacheKey);
    
    // if (location) {
    //   logInfo(`Cache hit for bus location: ${busId}`);
    //   return successResponse(JSON.parse(location));
    // }
    
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
    
    const result = await dynamodb.send(new QueryCommand(params));
    
    if (result.Items.length === 0) {
      return errorResponse(404, 'No location data found for this bus');
    }
    
    const latestLocation = result.Items[0];
    
    // Cache for 30 seconds
    // await redis.setex(cacheKey, 30, JSON.stringify(latestLocation)); // Redis temporarily disabled
    
    logOperatorAction(operatorId, 'GET_LOCATION', busId);
    
    return successResponse(latestLocation);
    
  } catch (error) {
    logError('Error getting location:', error);
    return errorResponse(500, 'Failed to retrieve location');
  }
}

module.exports = {
  getBuses: getBuses,
  getBus: getBus,
  createBus: createBus,
  updateBus: updateBus,
  deleteBus: deleteBus,
  updateLocation: updateLocation,
  getLocation: getLocation
};