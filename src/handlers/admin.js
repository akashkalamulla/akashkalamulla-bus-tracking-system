const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { error: logError, warn: logWarn, info: logInfo } = require('../utils/logger');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/response');
const { getUserContext } = require('./auth');

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

// =============================================================================
// ADMIN ROUTES MANAGEMENT (NTC ONLY)
// =============================================================================

/**
 * Admin - Get all routes with full administrative details
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.getRoutes = async (event) => {
  try {
    logInfo('Admin get routes request received');

    const userContext = getUserContext(event);

    const params = {
      TableName: process.env.ROUTES_TABLE
    };

    const result = await dynamodb.send(new ScanCommand(params));

    logInfo('Admin routes retrieved successfully', { 
      count: result.Items?.length || 0,
      user: userContext.userId,
      role: userContext.role 
    });

    return successResponse({
      message: 'Routes retrieved successfully',
      routes: result.Items || [],
      count: result.Items?.length || 0,
      adminContext: {
        userId: userContext.userId,
        role: userContext.role,
        accessLevel: 'FULL_ADMIN'
      }
    });

  } catch (error) {
    logError('Error retrieving admin routes', { 
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse('Failed to retrieve routes', 500);
  }
};

/**
 * Admin - Create new route
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.createRoute = async (event) => {
  try {
    logInfo('Admin create route request received');

    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return errorResponse('Invalid JSON in request body', 400);
    }

    const userContext = getUserContext(event);

    // Validate required fields
    const requiredFields = ['route_name', 'start_location', 'end_location'];
    const missingFields = requiredFields.filter(field => !requestBody[field]);
    
    if (missingFields.length > 0) {
      return errorResponse(`Missing required fields: ${missingFields.join(', ')}`, 400);
    }

    const routeId = requestBody.RouteID || `route_${uuidv4()}`;
    const timestamp = new Date().toISOString();

    const routeData = {
      RouteID: routeId,
      route_name: requestBody.route_name,
      start_location: requestBody.start_location,
      end_location: requestBody.end_location,
      description: requestBody.description || '',
      total_stops: requestBody.total_stops || 0,
      distance_km: requestBody.distance_km || 0,
      estimated_duration_minutes: requestBody.estimated_duration_minutes || 0,
      status: requestBody.status || 'ACTIVE',
      created_at: timestamp,
      updated_at: timestamp,
      created_by: userContext.userId,
      updated_by: userContext.userId
    };

    const params = {
      TableName: process.env.ROUTES_TABLE,
      Item: routeData,
      ConditionExpression: 'attribute_not_exists(RouteID)' // Prevent overwrite
    };

    await dynamodb.send(new PutCommand(params));

    logInfo('Route created successfully', { 
      routeId,
      user: userContext.userId,
      role: userContext.role
    });

    return successResponse({
      message: 'Route created successfully',
      routeId,
      route: routeData,
      createdBy: {
        userId: userContext.userId,
        role: userContext.role,
        timestamp
      }
    });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return errorResponse('Route ID already exists', 409);
    }

    logError('Error creating route', { 
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse('Failed to create route', 500);
  }
};

/**
 * Admin - Update route
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.updateRoute = async (event) => {
  try {
    const routeId = event.pathParameters?.routeId;
    if (!routeId) {
      return errorResponse('Route ID is required', 400);
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return errorResponse('Invalid JSON in request body', 400);
    }

    const userContext = getUserContext(event);

    // Allowed fields for update
    const allowedFields = ['route_name', 'start_location', 'end_location', 'description', 'total_stops', 'distance_km', 'estimated_duration_minutes', 'status'];
    const updateData = {};
    
    Object.keys(requestBody).forEach(key => {
      if (allowedFields.includes(key) && requestBody[key] !== undefined) {
        updateData[key] = requestBody[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    // Add metadata
    updateData.updated_at = new Date().toISOString();
    updateData.updated_by = userContext.userId;

    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updateData).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    });

    const params = {
      TableName: process.env.ROUTES_TABLE,
      Key: { RouteID: routeId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(RouteID)',
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));

    logInfo('Route updated successfully', { 
      routeId,
      user: userContext.userId,
      role: userContext.role
    });

    return successResponse({
      message: 'Route updated successfully',
      routeId,
      route: result.Attributes,
      updatedBy: {
        userId: userContext.userId,
        role: userContext.role,
        timestamp: updateData.updated_at
      }
    });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFoundResponse(`Route ${event.pathParameters?.routeId} not found`);
    }

    logError('Error updating route', { 
      error: error.message,
      routeId: event.pathParameters?.routeId,
      stack: error.stack
    });
    
    return errorResponse('Failed to update route', 500);
  }
};

/**
 * Admin - Delete route
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.deleteRoute = async (event) => {
  try {
    const routeId = event.pathParameters?.routeId;
    if (!routeId) {
      return errorResponse('Route ID is required', 400);
    }

    const userContext = getUserContext(event);

    const params = {
      TableName: process.env.ROUTES_TABLE,
      Key: { RouteID: routeId },
      ConditionExpression: 'attribute_exists(RouteID)',
      ReturnValues: 'ALL_OLD'
    };

    const result = await dynamodb.send(new DeleteCommand(params));

    logInfo('Route deleted successfully', { 
      routeId,
      user: userContext.userId,
      role: userContext.role
    });

    return successResponse({
      message: 'Route deleted successfully',
      routeId,
      deletedRoute: result.Attributes,
      deletedBy: {
        userId: userContext.userId,
        role: userContext.role,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFoundResponse(`Route ${event.pathParameters?.routeId} not found`);
    }

    logError('Error deleting route', { 
      error: error.message,
      routeId: event.pathParameters?.routeId,
      stack: error.stack
    });
    
    return errorResponse('Failed to delete route', 500);
  }
};

// =============================================================================
// ADMIN BUSES MANAGEMENT (NTC ONLY)
// =============================================================================

/**
 * Admin - Get all buses with full administrative details
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.getBuses = async (event) => {
  try {
    logInfo('Admin get buses request received');

    const userContext = getUserContext(event);

    const params = {
      TableName: process.env.BUSES_TABLE
    };

    const result = await dynamodb.send(new ScanCommand(params));

    logInfo('Admin buses retrieved successfully', { 
      count: result.Items?.length || 0,
      user: userContext.userId,
      role: userContext.role 
    });

    return successResponse({
      message: 'Buses retrieved successfully',
      buses: result.Items || [],
      count: result.Items?.length || 0,
      adminContext: {
        userId: userContext.userId,
        role: userContext.role,
        accessLevel: 'FULL_ADMIN'
      }
    });

  } catch (error) {
    logError('Error retrieving admin buses', { 
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse('Failed to retrieve buses', 500);
  }
};

/**
 * Admin - Create new bus
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.createBus = async (event) => {
  try {
    logInfo('Admin create bus request received');

    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return errorResponse('Invalid JSON in request body', 400);
    }

    const userContext = getUserContext(event);

    // Validate required fields
    const requiredFields = ['license_plate', 'RouteID'];
    const missingFields = requiredFields.filter(field => !requestBody[field]);
    
    if (missingFields.length > 0) {
      return errorResponse(`Missing required fields: ${missingFields.join(', ')}`, 400);
    }

    const busId = requestBody.BusID || `bus_${uuidv4()}`;
    const timestamp = new Date().toISOString();

    const busData = {
      BusID: busId,
      RouteID: requestBody.RouteID,
      license_plate: requestBody.license_plate,
      capacity: requestBody.capacity || 50,
      status: requestBody.status || 'ACTIVE',
      model: requestBody.model || '',
      year: requestBody.year || new Date().getFullYear(),
      operator_id: requestBody.operator_id || '',
      created_at: timestamp,
      updated_at: timestamp,
      created_by: userContext.userId,
      updated_by: userContext.userId
    };

    const params = {
      TableName: process.env.BUSES_TABLE,
      Item: busData,
      ConditionExpression: 'attribute_not_exists(BusID)'
    };

    await dynamodb.send(new PutCommand(params));

    logInfo('Bus created successfully', { 
      busId,
      user: userContext.userId,
      role: userContext.role
    });

    return successResponse({
      message: 'Bus created successfully',
      busId,
      bus: busData,
      createdBy: {
        userId: userContext.userId,
        role: userContext.role,
        timestamp
      }
    });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return errorResponse('Bus ID already exists', 409);
    }

    logError('Error creating bus', { 
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse('Failed to create bus', 500);
  }
};

/**
 * Admin - Update bus
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.updateBus = async (event) => {
  try {
    const busId = event.pathParameters?.busId;
    if (!busId) {
      return errorResponse('Bus ID is required', 400);
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return errorResponse('Invalid JSON in request body', 400);
    }

    const userContext = getUserContext(event);

    // Allowed fields for update
    const allowedFields = ['RouteID', 'license_plate', 'capacity', 'status', 'model', 'year', 'operator_id'];
    const updateData = {};
    
    Object.keys(requestBody).forEach(key => {
      if (allowedFields.includes(key) && requestBody[key] !== undefined) {
        updateData[key] = requestBody[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    // Add metadata
    updateData.updated_at = new Date().toISOString();
    updateData.updated_by = userContext.userId;

    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updateData).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    });

    const params = {
      TableName: process.env.BUSES_TABLE,
      Key: { BusID: busId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(BusID)',
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));

    logInfo('Admin bus updated successfully', { 
      busId,
      user: userContext.userId,
      role: userContext.role
    });

    return successResponse({
      message: 'Bus updated successfully',
      busId,
      bus: result.Attributes,
      updatedBy: {
        userId: userContext.userId,
        role: userContext.role,
        timestamp: updateData.updated_at
      }
    });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFoundResponse(`Bus ${event.pathParameters?.busId} not found`);
    }

    logError('Error updating admin bus', { 
      error: error.message,
      busId: event.pathParameters?.busId,
      stack: error.stack
    });
    
    return errorResponse('Failed to update bus', 500);
  }
};

/**
 * Admin - Delete bus
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.deleteBus = async (event) => {
  try {
    const busId = event.pathParameters?.busId;
    if (!busId) {
      return errorResponse('Bus ID is required', 400);
    }

    const userContext = getUserContext(event);

    const params = {
      TableName: process.env.BUSES_TABLE,
      Key: { BusID: busId },
      ConditionExpression: 'attribute_exists(BusID)',
      ReturnValues: 'ALL_OLD'
    };

    const result = await dynamodb.send(new DeleteCommand(params));

    logInfo('Admin bus deleted successfully', { 
      busId,
      user: userContext.userId,
      role: userContext.role
    });

    return successResponse({
      message: 'Bus deleted successfully',
      busId,
      deletedBus: result.Attributes,
      deletedBy: {
        userId: userContext.userId,
        role: userContext.role,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFoundResponse(`Bus ${event.pathParameters?.busId} not found`);
    }

    logError('Error deleting admin bus', { 
      error: error.message,
      busId: event.pathParameters?.busId,
      stack: error.stack
    });
    
    return errorResponse('Failed to delete bus', 500);
  }
};

// =============================================================================
// ADMIN HISTORY AND ANALYTICS (NTC ONLY)
// =============================================================================

/**
 * Admin - Get location history and analytics
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.getHistory = async (event) => {
  try {
    logInfo('Admin get history request received');

    const userContext = getUserContext(event);

    // Get query parameters for filtering
    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit) || 100;
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate;

    const params = {
      TableName: process.env.LIVE_LOCATIONS_TABLE,
      Limit: Math.min(limit, 1000) // Cap at 1000 for performance
    };

    // Add time-based filtering if provided
    if (startDate && endDate) {
      params.FilterExpression = '#timestamp BETWEEN :startDate AND :endDate';
      params.ExpressionAttributeNames = { '#timestamp': 'timestamp' };
      params.ExpressionAttributeValues = {
        ':startDate': startDate,
        ':endDate': endDate
      };
    }

    const result = await dynamodb.send(new ScanCommand(params));

    // Generate basic analytics
    const analytics = generateLocationAnalytics(result.Items || []);

    logInfo('Admin history retrieved successfully', { 
      recordCount: result.Items?.length || 0,
      user: userContext.userId,
      role: userContext.role 
    });

    return successResponse({
      message: 'Location history retrieved successfully',
      locations: result.Items || [],
      analytics,
      query: {
        limit,
        startDate,
        endDate,
        totalRecords: result.Items?.length || 0
      },
      adminContext: {
        userId: userContext.userId,
        role: userContext.role,
        accessLevel: 'FULL_ADMIN'
      }
    });

  } catch (error) {
    logError('Error retrieving admin history', { 
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse('Failed to retrieve location history', 500);
  }
};

/**
 * Admin - Get specific bus location history
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.getBusHistory = async (event) => {
  try {
    const busId = event.pathParameters?.busId;
    if (!busId) {
      return errorResponse('Bus ID is required', 400);
    }

    logInfo('Admin get bus history request received', { busId });

    const userContext = getUserContext(event);

    // Get query parameters for filtering
    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit) || 100;
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate;

    const params = {
      TableName: process.env.LIVE_LOCATIONS_TABLE,
      KeyConditionExpression: 'BusID = :busId',
      ExpressionAttributeValues: {
        ':busId': busId
      },
      Limit: Math.min(limit, 1000),
      ScanIndexForward: false // Most recent first
    };

    // Add time-based filtering if provided
    if (startDate && endDate) {
      params.KeyConditionExpression += ' AND #timestamp BETWEEN :startDate AND :endDate';
      params.ExpressionAttributeNames = { '#timestamp': 'timestamp' };
      params.ExpressionAttributeValues[':startDate'] = startDate;
      params.ExpressionAttributeValues[':endDate'] = endDate;
    }

    const result = await dynamodb.send(new QueryCommand(params));

    // Generate bus-specific analytics
    const analytics = generateBusAnalytics(result.Items || []);

    logInfo('Admin bus history retrieved successfully', { 
      busId,
      recordCount: result.Items?.length || 0,
      user: userContext.userId,
      role: userContext.role 
    });

    return successResponse({
      message: 'Bus location history retrieved successfully',
      busId,
      locations: result.Items || [],
      analytics,
      query: {
        limit,
        startDate,
        endDate,
        totalRecords: result.Items?.length || 0
      },
      adminContext: {
        userId: userContext.userId,
        role: userContext.role,
        accessLevel: 'FULL_ADMIN'
      }
    });

  } catch (error) {
    logError('Error retrieving admin bus history', { 
      error: error.message,
      busId: event.pathParameters?.busId,
      stack: error.stack
    });
    
    return errorResponse('Failed to retrieve bus location history', 500);
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate analytics from location data
 * @param {Array} locations - Array of location records
 * @returns {Object} - Analytics data
 */
function generateLocationAnalytics(locations) {
  if (!locations || locations.length === 0) {
    return {
      totalRecords: 0,
      uniqueBuses: 0,
      dateRange: null,
      averageSpeed: 0
    };
  }

  const uniqueBuses = new Set(locations.map(loc => loc.BusID)).size;
  const timestamps = locations.map(loc => loc.timestamp).filter(t => t).sort();
  const speeds = locations.map(loc => loc.speed).filter(s => s && s > 0);
  
  return {
    totalRecords: locations.length,
    uniqueBuses,
    dateRange: timestamps.length > 0 ? {
      earliest: timestamps[0],
      latest: timestamps[timestamps.length - 1]
    } : null,
    averageSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
  };
}

/**
 * Generate bus-specific analytics
 * @param {Array} locations - Array of location records for a specific bus
 * @returns {Object} - Bus analytics data
 */
function generateBusAnalytics(locations) {
  if (!locations || locations.length === 0) {
    return {
      totalRecords: 0,
      dateRange: null,
      averageSpeed: 0,
      totalDistance: 0
    };
  }

  const timestamps = locations.map(loc => loc.timestamp).filter(t => t).sort();
  const speeds = locations.map(loc => loc.speed).filter(s => s && s > 0);
  
  // Calculate approximate total distance (simplified)
  let totalDistance = 0;
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];
    
    if (prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
      // Simple distance calculation (not exact but gives an estimate)
      const latDiff = curr.latitude - prev.latitude;
      const lonDiff = curr.longitude - prev.longitude;
      const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111; // Rough km conversion
      totalDistance += distance;
    }
  }

  return {
    totalRecords: locations.length,
    dateRange: timestamps.length > 0 ? {
      earliest: timestamps[0],
      latest: timestamps[timestamps.length - 1]
    } : null,
    averageSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
    totalDistance: Math.round(totalDistance * 100) / 100 // Round to 2 decimal places
  };
}