const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const Redis = require('ioredis');
const { error: logError, warn: logWarn, info: logInfo, debug: logDebug } = require('../../utils/logger');
const { successResponse, errorResponse, notFoundResponse } = require('../../utils/response');
const { getUserContext } = require('../auth');
const { withRateLimit } = require('../../utils/rate-limiter');

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

// Initialize Redis client with error handling
let redis = null;
try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
  } else if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
  } else if (process.env.REDIS_ENDPOINT) {
    redis = new Redis({
      host: process.env.REDIS_ENDPOINT,
      port: process.env.REDIS_PORT_REF || 6379,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
  }
} catch (redisError) {
  logWarn('Redis initialization failed, caching disabled', { error: redisError.message });
}

// Cache configuration
const CACHE_CONFIG = {
  ROUTES_LIST_KEY: 'admin:routes:list',
  ROUTE_KEY_PREFIX: 'admin:route:',
  TTL: 300 // 5 minutes
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get cache key for a specific route
 * @param {string} routeId - Route ID
 * @returns {string} - Cache key
 */
function getRouteCacheKey(routeId) {
  return `${CACHE_CONFIG.ROUTE_KEY_PREFIX}${routeId}`;
}

/**
 * Invalidate route-related cache entries
 * @param {string} routeId - Optional specific route ID to invalidate
 */
async function invalidateRouteCache(routeId = null) {
  if (!redis) return;

  try {
    const keysToDelete = [CACHE_CONFIG.ROUTES_LIST_KEY];
    
    if (routeId) {
      keysToDelete.push(getRouteCacheKey(routeId));
    }

    await redis.del(...keysToDelete);
    logDebug('Route cache invalidated', { routeId, keysDeleted: keysToDelete });
  } catch (error) {
    logError('Failed to invalidate route cache', { error: error.message, routeId });
  }
}

/**
 * Log admin action for audit trail
 * @param {Object} params - Action parameters
 */
function logAdminAction(params) {
  const { action, routeId, userId, role, data, success, error } = params;
  
  const auditLog = {
    timestamp: new Date().toISOString(),
    action,
    resource: 'route',
    resourceId: routeId,
    adminUser: {
      userId,
      role
    },
    data: data || {},
    success: success || false,
    error: error || null,
    ip: params.sourceIp || 'unknown',
    userAgent: params.userAgent || 'unknown'
  };

  logInfo('Admin action audit', auditLog);
}

/**
 * Validate route data
 * @param {Object} routeData - Route data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} - Validation result
 */
function validateRouteData(routeData, isUpdate = false) {
  const errors = [];
  
  // Required fields for new routes
  if (!isUpdate) {
    const requiredFields = ['route_name', 'start_location', 'end_location'];
    requiredFields.forEach(field => {
      if (!routeData[field] || typeof routeData[field] !== 'string' || routeData[field].trim().length === 0) {
        errors.push(`${field} is required and must be a non-empty string`);
      }
    });
  }

  // Optional field validations
  if (routeData.total_stops !== undefined) {
    if (!Number.isInteger(routeData.total_stops) || routeData.total_stops < 0) {
      errors.push('total_stops must be a non-negative integer');
    }
  }

  if (routeData.distance_km !== undefined) {
    if (typeof routeData.distance_km !== 'number' || routeData.distance_km < 0) {
      errors.push('distance_km must be a non-negative number');
    }
  }

  if (routeData.estimated_duration_minutes !== undefined) {
    if (!Number.isInteger(routeData.estimated_duration_minutes) || routeData.estimated_duration_minutes < 0) {
      errors.push('estimated_duration_minutes must be a non-negative integer');
    }
  }

  if (routeData.status !== undefined) {
    const validStatuses = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'SUSPENDED'];
    if (!validStatuses.includes(routeData.status)) {
      errors.push(`status must be one of: ${validStatuses.join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get user context from API Gateway authorizer
 * @param {Object} event - Lambda event from API Gateway
 * @returns {Object} - User context with role validation
 */
function getAdminContext(event) {
  try {
    const userContext = getUserContext(event);
    
    // Validate NTC role for admin operations
    if (userContext.role !== 'NTC') {
      throw new Error(`Insufficient privileges. Required: NTC, Current: ${userContext.role}`);
    }

    return userContext;
  } catch (error) {
    logError('Failed to get admin context', { error: error.message });
    throw new Error('Authorization failed');
  }
}

/**
 * Log admin action for audit trail
 * @param {Object} context - User context
 * @param {string} action - Action performed
 * @param {Object} details - Additional details
 */
function logAdminAction(context, action, details = {}) {
  logInfo('Admin action performed', {
    adminUserId: context.userId,
    adminRole: context.role,
    action,
    timestamp: new Date().toISOString(),
    details,
    auditTrail: true
  });
}

/**
 * Invalidate route-related cache entries
 * @param {string} routeId - Optional specific route ID
 */
async function invalidateCache(routeId = null) {
  if (!redis) return;

  try {
    const keysToDelete = [CACHE_CONFIG.ROUTES_LIST_KEY, CACHE_CONFIG.STATS_KEY];
    
    if (routeId) {
      keysToDelete.push(`${CACHE_CONFIG.ROUTE_KEY_PREFIX}${routeId}`);
    } else {
      // If no specific route, clear all route caches
      const routeKeys = await redis.keys(`${CACHE_CONFIG.ROUTE_KEY_PREFIX}*`);
      keysToDelete.push(...routeKeys);
    }

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      logDebug('Cache invalidated', { keys: keysToDelete });
    }
  } catch (error) {
    logWarn('Cache invalidation failed', { error: error.message, routeId });
  }
}

/**
 * Get data from cache
 * @param {string} key - Cache key
 * @returns {Object|null} - Cached data or null
 */
async function getFromCache(key) {
  if (!redis) return null;

  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logWarn('Cache read failed', { error: error.message, key });
    return null;
  }
}

/**
 * Set data in cache
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 * @param {number} ttl - Time to live in seconds
 */
async function setCache(key, data, ttl = CACHE_CONFIG.TTL_SECONDS) {
  if (!redis) return;

  try {
    await redis.setex(key, ttl, JSON.stringify(data));
    logDebug('Data cached', { key, ttl });
  } catch (error) {
    logWarn('Cache write failed', { error: error.message, key });
  }
}

/**
 * Validate route data
 * @param {Object} routeData - Route data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} - Validation result
 */
function validateRouteData(routeData, isUpdate = false) {
  const errors = [];
  const requiredFields = isUpdate ? [] : ['route_name', 'start_location', 'end_location'];
  
  // Check required fields for creation
  requiredFields.forEach(field => {
    if (!routeData[field] || String(routeData[field]).trim() === '') {
      errors.push(`${field} is required`);
    }
  });

  // Validate optional numeric fields
  const numericFields = ['total_stops', 'distance_km', 'estimated_duration_minutes', 'fare_rs'];
  numericFields.forEach(field => {
    if (routeData[field] !== undefined && routeData[field] !== null) {
      const value = Number(routeData[field]);
      if (isNaN(value) || value < 0) {
        errors.push(`${field} must be a non-negative number`);
      }
    }
  });

  // Validate status
  if (routeData.status && !['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'SUSPENDED'].includes(routeData.status)) {
    errors.push('status must be one of: ACTIVE, INACTIVE, MAINTENANCE, SUSPENDED');
  }

  // Validate route type
  if (routeData.route_type && !['inter-provincial', 'intra-provincial', 'urban', 'express', 'local'].includes(routeData.route_type)) {
    errors.push('route_type must be one of: inter-provincial, intra-provincial, urban, express, local');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate route statistics
 * @param {Array} routes - Array of routes
 * @returns {Object} - Route statistics
 */
function generateRouteStats(routes) {
  const stats = {
    total: routes.length,
    byStatus: {},
    byType: {},
    totalDistance: 0,
    averageDistance: 0,
    totalStops: 0,
    averageStops: 0,
    totalFare: 0,
    averageFare: 0
  };

  let distanceCount = 0;
  let stopsCount = 0;
  let fareCount = 0;

  routes.forEach(route => {
    // Count by status
    const status = route.status || 'UNKNOWN';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

    // Count by type
    const type = route.route_type || 'UNKNOWN';
    stats.byType[type] = (stats.byType[type] || 0) + 1;

    // Accumulate metrics
    if (route.distance_km && !isNaN(route.distance_km)) {
      stats.totalDistance += Number(route.distance_km);
      distanceCount++;
    }

    if (route.total_stops && !isNaN(route.total_stops)) {
      stats.totalStops += Number(route.total_stops);
      stopsCount++;
    }

    if (route.fare_rs && !isNaN(route.fare_rs)) {
      stats.totalFare += Number(route.fare_rs);
      fareCount++;
    }
  });

  // Calculate averages
  stats.averageDistance = distanceCount > 0 ? Math.round((stats.totalDistance / distanceCount) * 100) / 100 : 0;
  stats.averageStops = stopsCount > 0 ? Math.round((stats.totalStops / stopsCount) * 100) / 100 : 0;
  stats.averageFare = fareCount > 0 ? Math.round((stats.totalFare / fareCount) * 100) / 100 : 0;

  return stats;
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * GET /admin/routes - Get all routes with admin details
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.getAllRoutes = async (event) => {
  try {
    logInfo('Admin get all routes request received');

    // Validate admin context
    const adminContext = getAdminContext(event);

    // Try to get from cache first
    const cacheKey = CACHE_CONFIG.ROUTES_LIST_KEY;
    let cachedData = await getFromCache(cacheKey);

    if (cachedData) {
      logInfo('Routes retrieved from cache', { 
        count: cachedData.routes?.length || 0,
        adminUser: adminContext.userId 
      });

      logAdminAction(adminContext, 'GET_ALL_ROUTES', { 
        source: 'cache',
        count: cachedData.routes?.length || 0
      });

      return successResponse({
        message: 'Routes retrieved successfully (cached)',
        ...cachedData,
        cached: true,
        adminContext: {
          userId: adminContext.userId,
          role: adminContext.role,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Fetch from DynamoDB
    const params = {
      TableName: process.env.ROUTES_TABLE
    };

    const result = await dynamodb.send(new ScanCommand(params));
    const routes = result.Items || [];

    // Generate statistics
    const stats = generateRouteStats(routes);

    // Prepare response data
    const responseData = {
      routes,
      count: routes.length,
      statistics: stats,
      lastUpdated: new Date().toISOString()
    };

    // Cache the data
    await setCache(cacheKey, responseData);

    logInfo('Routes retrieved from database', { 
      count: routes.length,
      adminUser: adminContext.userId 
    });

    logAdminAction(adminContext, 'GET_ALL_ROUTES', { 
      source: 'database',
      count: routes.length,
      statistics: stats
    });

    return successResponse({
      message: 'Routes retrieved successfully',
      ...responseData,
      cached: false,
      adminContext: {
        userId: adminContext.userId,
        role: adminContext.role,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error.message.includes('Insufficient privileges') || error.message.includes('Authorization failed')) {
      logWarn('Unauthorized admin routes access attempt', { 
        error: error.message,
        userAgent: event.headers?.['User-Agent']
      });
      return errorResponse('Access denied: NTC role required', 403);
    }

    logError('Error retrieving admin routes', { 
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse('Failed to retrieve routes', 500);
  }
};

/**
 * GET /admin/routes/{routeId} - Get specific route with admin details
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.getRoute = async (event) => {
  try {
    const routeId = event.pathParameters?.routeId;
    if (!routeId) {
      return errorResponse('Route ID is required', 400);
    }

    logInfo('Admin get route request received', { routeId });

    // Validate admin context
    const adminContext = getAdminContext(event);

    // Try to get from cache first
    const cacheKey = `${CACHE_CONFIG.ROUTE_KEY_PREFIX}${routeId}`;
    let cachedData = await getFromCache(cacheKey);

    if (cachedData) {
      logInfo('Route retrieved from cache', { 
        routeId,
        adminUser: adminContext.userId 
      });

      logAdminAction(adminContext, 'GET_ROUTE', { 
        routeId,
        source: 'cache'
      });

      return successResponse({
        message: 'Route retrieved successfully (cached)',
        routeId,
        route: cachedData,
        cached: true,
        adminContext: {
          userId: adminContext.userId,
          role: adminContext.role,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Fetch from DynamoDB
    const params = {
      TableName: process.env.ROUTES_TABLE,
      Key: { RouteID: routeId }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
      logWarn('Route not found', { routeId, adminUser: adminContext.userId });
      return notFoundResponse(`Route ${routeId} not found`);
    }

    // Cache the data
    await setCache(cacheKey, result.Item);

    logInfo('Route retrieved from database', { 
      routeId,
      adminUser: adminContext.userId 
    });

    logAdminAction(adminContext, 'GET_ROUTE', { 
      routeId,
      source: 'database'
    });

    return successResponse({
      message: 'Route retrieved successfully',
      routeId,
      route: result.Item,
      cached: false,
      adminContext: {
        userId: adminContext.userId,
        role: adminContext.role,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error.message.includes('Insufficient privileges') || error.message.includes('Authorization failed')) {
      return errorResponse('Access denied: NTC role required', 403);
    }

    logError('Error retrieving admin route', { 
      error: error.message,
      routeId: event.pathParameters?.routeId,
      stack: error.stack
    });
    
    return errorResponse('Failed to retrieve route', 500);
  }
};

/**
 * POST /admin/routes - Create new route
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.createRoute = async (event) => {
  try {
    logInfo('Admin create route request received');

    // Validate admin context
    const adminContext = getAdminContext(event);

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return errorResponse('Invalid JSON in request body', 400);
    }

    // Validate route data
    const validation = validateRouteData(requestBody, false);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Generate route ID
    const routeId = requestBody.RouteID || `route_${uuidv4()}`;
    const timestamp = new Date().toISOString();

    // Prepare route data
    const routeData = {
      RouteID: routeId,
      route_name: requestBody.route_name.trim(),
      start_location: requestBody.start_location.trim(),
      end_location: requestBody.end_location.trim(),
      description: requestBody.description?.trim() || '',
      total_stops: Number(requestBody.total_stops) || 0,
      distance_km: Number(requestBody.distance_km) || 0,
      estimated_duration_minutes: Number(requestBody.estimated_duration_minutes) || 0,
      estimated_duration_hours: Number(requestBody.estimated_duration_minutes) ? 
        Number(requestBody.estimated_duration_minutes) / 60 : 0,
      fare_rs: Number(requestBody.fare_rs) || 0,
      route_type: requestBody.route_type || 'local',
      status: requestBody.status || 'ACTIVE',
      service_frequency: requestBody.service_frequency || '',
      first_departure: requestBody.first_departure || '05:00',
      last_departure: requestBody.last_departure || '20:00',
      operates_on: requestBody.operates_on || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      intermediate_stops: requestBody.intermediate_stops || [],
      from_city: requestBody.from_city || '',
      to_city: requestBody.to_city || '',
      created_at: timestamp,
      updated_at: timestamp,
      created_by: adminContext.userId,
      updated_by: adminContext.userId
    };

    // Save to DynamoDB
    const params = {
      TableName: process.env.ROUTES_TABLE,
      Item: routeData,
      ConditionExpression: 'attribute_not_exists(RouteID)' // Prevent overwrite
    };

    await dynamodb.send(new PutCommand(params));

    // Invalidate cache
    await invalidateCache();

    logInfo('Route created successfully', { 
      routeId,
      adminUser: adminContext.userId 
    });

    logAdminAction(adminContext, 'CREATE_ROUTE', { 
      routeId,
      routeName: routeData.route_name,
      status: routeData.status,
      routeType: routeData.route_type
    });

    return successResponse({
      message: 'Route created successfully',
      routeId,
      route: routeData,
      createdBy: {
        userId: adminContext.userId,
        role: adminContext.role,
        timestamp
      }
    }, 201);

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return errorResponse('Route ID already exists', 409);
    }

    if (error.message.includes('Insufficient privileges') || error.message.includes('Authorization failed')) {
      return errorResponse('Access denied: NTC role required', 403);
    }

    logError('Error creating route', { 
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse('Failed to create route', 500);
  }
};

/**
 * PUT /admin/routes/{routeId} - Update route
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.updateRoute = async (event) => {
  try {
    const routeId = event.pathParameters?.routeId;
    if (!routeId) {
      return errorResponse('Route ID is required', 400);
    }

    logInfo('Admin update route request received', { routeId });

    // Validate admin context
    const adminContext = getAdminContext(event);

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return errorResponse('Invalid JSON in request body', 400);
    }

    // Validate route data
    const validation = validateRouteData(requestBody, true);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Prepare update data
    const allowedFields = [
      'route_name', 'start_location', 'end_location', 'description', 'total_stops',
      'distance_km', 'estimated_duration_minutes', 'fare_rs', 'route_type', 'status',
      'service_frequency', 'first_departure', 'last_departure', 'operates_on',
      'intermediate_stops', 'from_city', 'to_city'
    ];

    const updateData = {};
    let changedFields = [];

    allowedFields.forEach(field => {
      if (requestBody[field] !== undefined) {
        if (field === 'route_name' || field === 'start_location' || field === 'end_location' || field === 'description') {
          updateData[field] = String(requestBody[field]).trim();
        } else if (['total_stops', 'distance_km', 'estimated_duration_minutes', 'fare_rs'].includes(field)) {
          updateData[field] = Number(requestBody[field]);
          if (field === 'estimated_duration_minutes') {
            updateData.estimated_duration_hours = updateData[field] / 60;
          }
        } else {
          updateData[field] = requestBody[field];
        }
        changedFields.push(field);
      }
    });

    if (changedFields.length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    // Add metadata
    updateData.updated_at = new Date().toISOString();
    updateData.updated_by = adminContext.userId;

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

    // Update in DynamoDB
    const params = {
      TableName: process.env.ROUTES_TABLE,
      Key: { RouteID: routeId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(RouteID)', // Ensure route exists
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));

    // Invalidate cache
    await invalidateCache(routeId);

    logInfo('Route updated successfully', { 
      routeId,
      changedFields,
      adminUser: adminContext.userId 
    });

    logAdminAction(adminContext, 'UPDATE_ROUTE', { 
      routeId,
      changedFields,
      routeName: result.Attributes.route_name
    });

    return successResponse({
      message: 'Route updated successfully',
      routeId,
      route: result.Attributes,
      changedFields,
      updatedBy: {
        userId: adminContext.userId,
        role: adminContext.role,
        timestamp: updateData.updated_at
      }
    });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFoundResponse(`Route ${event.pathParameters?.routeId} not found`);
    }

    if (error.message.includes('Insufficient privileges') || error.message.includes('Authorization failed')) {
      return errorResponse('Access denied: NTC role required', 403);
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
 * DELETE /admin/routes/{routeId} - Delete route
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.deleteRoute = async (event) => {
  try {
    const routeId = event.pathParameters?.routeId;
    if (!routeId) {
      return errorResponse('Route ID is required', 400);
    }

    logInfo('Admin delete route request received', { routeId });

    // Validate admin context
    const adminContext = getAdminContext(event);

    // Delete from DynamoDB
    const params = {
      TableName: process.env.ROUTES_TABLE,
      Key: { RouteID: routeId },
      ConditionExpression: 'attribute_exists(RouteID)', // Ensure route exists
      ReturnValues: 'ALL_OLD'
    };

    const result = await dynamodb.send(new DeleteCommand(params));

    // Invalidate cache
    await invalidateCache(routeId);

    logInfo('Route deleted successfully', { 
      routeId,
      adminUser: adminContext.userId 
    });

    logAdminAction(adminContext, 'DELETE_ROUTE', { 
      routeId,
      routeName: result.Attributes?.route_name || 'Unknown',
      previousStatus: result.Attributes?.status || 'Unknown'
    });

    return successResponse({
      message: 'Route deleted successfully',
      routeId,
      deletedRoute: result.Attributes,
      deletedBy: {
        userId: adminContext.userId,
        role: adminContext.role,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFoundResponse(`Route ${event.pathParameters?.routeId} not found`);
    }

    if (error.message.includes('Insufficient privileges') || error.message.includes('Authorization failed')) {
      return errorResponse('Access denied: NTC role required', 403);
    }

    logError('Error deleting route', { 
      error: error.message,
      routeId: event.pathParameters?.routeId,
      stack: error.stack
    });
    
    return errorResponse('Failed to delete route', 500);
  }
};

// Export functions directly without rate limiting for now
// const originalGetAllRoutes = exports.getAllRoutes;
// const originalGetRoute = exports.getRoute;
// const originalCreateRoute = exports.createRoute;
// const originalUpdateRoute = exports.updateRoute;
// const originalDeleteRoute = exports.deleteRoute;

// exports.getAllRoutes = withRateLimit(originalGetAllRoutes, 'ADMIN');
// exports.getRoute = withRateLimit(originalGetRoute, 'ADMIN');
// exports.createRoute = withRateLimit(originalCreateRoute, 'ADMIN');
// exports.updateRoute = withRateLimit(originalUpdateRoute, 'ADMIN');
// exports.deleteRoute = withRateLimit(originalDeleteRoute, 'ADMIN');