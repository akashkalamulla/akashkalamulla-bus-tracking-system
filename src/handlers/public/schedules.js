const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');
const { error: logError, warn: logWarn, info: logInfo, debug: logDebug } = require('../../utils/logger');
const { successResponse, errorResponse } = require('../../utils/response');

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE || 'BusSchedules';

// Debug environment variables
logInfo('Environment variables', {
  SCHEDULES_TABLE: process.env.SCHEDULES_TABLE,
  actual_SCHEDULES_TABLE: SCHEDULES_TABLE
});

// Cache TTL settings (aggressive caching for public data)
const CACHE_TTL = {
  SCHEDULES: 1800,      // 30 minutes for schedules
  SCHEDULE_DETAILS: 3600 // 1 hour for specific schedule details
};

// Pagination settings
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Generate ETag for response data
 */
function generateETag(data) {
  const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  return `"${hash}"`;
}

/**
 * Parse pagination parameters from query string
 */
function parsePaginationParams(event) {
  const queryParams = event.queryStringParameters || {};
  
  let limit = parseInt(queryParams.limit) || DEFAULT_PAGE_SIZE;
  limit = Math.min(limit, MAX_PAGE_SIZE); // Enforce max page size
  
  const page = Math.max(1, parseInt(queryParams.page) || 1);
  const offset = (page - 1) * limit;
  
  return { limit, page, offset };
}

/**
 * Create paginated response with metadata
 */
function createPaginatedResponse(items, totalCount, page, limit, baseUrl) {
  const totalPages = Math.ceil(totalCount / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  
  const pagination = {
    currentPage: page,
    totalPages,
    totalItems: totalCount,
    itemsPerPage: limit,
    hasNext,
    hasPrevious: hasPrev
  };
  
  const links = {
    self: `${baseUrl}?page=${page}&limit=${limit}`,
    first: `${baseUrl}?page=1&limit=${limit}`,
    last: `${baseUrl}?page=${totalPages}&limit=${limit}`
  };
  
  if (hasNext) {
    links.next = `${baseUrl}?page=${page + 1}&limit=${limit}`;
  }
  
  if (hasPrev) {
    links.prev = `${baseUrl}?page=${page - 1}&limit=${limit}`;
  }
  
  return {
    data: items,
    pagination,
    links,
    meta: {
      cached: false,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * GET /public/routes/{routeId}/schedules
 * Get all schedules for a specific route
 */
module.exports.getRouteSchedules = async (event) => {
  try {
    const routeId = event.pathParameters?.routeId;
    const { limit, page, offset } = parsePaginationParams(event);
    const queryParams = event.queryStringParameters || {};
    
    if (!routeId) {
      logWarn('Missing routeId parameter');
      return errorResponse(400, 'Route ID is required');
    }
    
    logInfo('Getting schedules for route', { routeId, page, limit });
    
    // Build query parameters for filtering
    const filterParams = {
      TableName: SCHEDULES_TABLE,
      IndexName: 'RouteScheduleIndex', // GSI on route_id
      KeyConditionExpression: 'route_id = :routeId',
      ExpressionAttributeValues: {
        ':routeId': routeId
      },
      Limit: limit
    };
    
    // Add date filtering if provided
    if (queryParams.date) {
      filterParams.FilterExpression = 'schedule_date = :date';
      filterParams.ExpressionAttributeValues[':date'] = queryParams.date;
    }
    
    // Add trip period filtering if provided (morning, afternoon, evening)
    if (queryParams.period) {
      const expression = filterParams.FilterExpression || '';
      filterParams.FilterExpression = expression 
        ? `${expression} AND trip_period = :period`
        : 'trip_period = :period';
      filterParams.ExpressionAttributeValues[':period'] = queryParams.period.toLowerCase();
    }
    
    // Add status filtering if provided
    if (queryParams.status) {
      const expression = filterParams.FilterExpression || '';
      filterParams.FilterExpression = expression 
        ? `${expression} AND trip_status = :status`
        : 'trip_status = :status';
      filterParams.ExpressionAttributeValues[':status'] = queryParams.status.toLowerCase();
    }
    
    const command = new QueryCommand(filterParams);
    const result = await dynamodb.send(command);
    
    if (!result.Items || result.Items.length === 0) {
      logInfo('No schedules found for route', { routeId });
      return successResponse({
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit,
          hasNext: false,
          hasPrevious: false
        },
        meta: {
          cached: false,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Sort by departure time
    const sortedSchedules = result.Items.sort((a, b) => {
      return a.departure_time.localeCompare(b.departure_time);
    });
    
    // Apply pagination manually for filtered results
    const paginatedItems = sortedSchedules.slice(offset, offset + limit);
    const totalCount = sortedSchedules.length;
    
    // Generate ETag for caching
    const etag = generateETag(paginatedItems);
    
    // Check if client has cached version
    const clientETag = event.headers['If-None-Match'];
    if (clientETag === etag) {
      return {
        statusCode: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': `public, max-age=${CACHE_TTL.SCHEDULES}`
        }
      };
    }
    
    const baseUrl = `/public/routes/${routeId}/schedules`;
    const response = createPaginatedResponse(paginatedItems, totalCount, page, limit, baseUrl);
    
    logInfo('Successfully retrieved route schedules', { 
      routeId, 
      count: paginatedItems.length,
      totalCount,
      page
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'ETag': etag,
        'Cache-Control': `public, max-age=${CACHE_TTL.SCHEDULES}`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(response)
    };
    
  } catch (error) {
    logError('Failed to get route schedules', { error: error.message, stack: error.stack });
    return errorResponse(500, 'Failed to retrieve route schedules');
  }
};

/**
 * GET /public/schedules
 * Get all schedules with optional filtering
 */
module.exports.getSchedules = async (event) => {
  try {
    const { limit, page, offset } = parsePaginationParams(event);
    const queryParams = event.queryStringParameters || {};
    
    logInfo('Getting all schedules', { page, limit, filters: queryParams });
    
    // Build scan parameters
    const scanParams = {
      TableName: SCHEDULES_TABLE,
      Limit: limit
    };
    
    // Build filter expression based on query parameters
    const filterExpressions = [];
    const expressionAttributeValues = {};
    
    // Date filtering
    if (queryParams.date) {
      filterExpressions.push('schedule_date = :date');
      expressionAttributeValues[':date'] = queryParams.date;
    }
    
    // Route filtering
    if (queryParams.routeId) {
      filterExpressions.push('route_id = :routeId');
      expressionAttributeValues[':routeId'] = queryParams.routeId;
    }
    
    // Trip period filtering
    if (queryParams.period) {
      filterExpressions.push('trip_period = :period');
      expressionAttributeValues[':period'] = queryParams.period.toLowerCase();
    }
    
    // Status filtering
    if (queryParams.status) {
      filterExpressions.push('trip_status = :status');
      expressionAttributeValues[':status'] = queryParams.status.toLowerCase();
    }
    
    // Bus ID filtering
    if (queryParams.busId) {
      filterExpressions.push('BusID = :busId');
      expressionAttributeValues[':busId'] = queryParams.busId;
    }
    
    if (filterExpressions.length > 0) {
      scanParams.FilterExpression = filterExpressions.join(' AND ');
      scanParams.ExpressionAttributeValues = expressionAttributeValues;
    }
    
    const command = new ScanCommand(scanParams);
    const result = await dynamodb.send(command);
    
    if (!result.Items || result.Items.length === 0) {
      logInfo('No schedules found');
      return successResponse({
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit,
          hasNext: false,
          hasPrevious: false
        },
        meta: {
          cached: false,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Sort by date and departure time
    const sortedSchedules = result.Items.sort((a, b) => {
      const dateCompare = a.schedule_date.localeCompare(b.schedule_date);
      if (dateCompare !== 0) return dateCompare;
      return a.departure_time.localeCompare(b.departure_time);
    });
    
    // Apply pagination
    const paginatedItems = sortedSchedules.slice(offset, offset + limit);
    const totalCount = sortedSchedules.length;
    
    // Generate ETag for caching
    const etag = generateETag(paginatedItems);
    
    // Check if client has cached version
    const clientETag = event.headers['If-None-Match'];
    if (clientETag === etag) {
      return {
        statusCode: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': `public, max-age=${CACHE_TTL.SCHEDULES}`
        }
      };
    }
    
    const baseUrl = '/public/schedules';
    const response = createPaginatedResponse(paginatedItems, totalCount, page, limit, baseUrl);
    
    logInfo('Successfully retrieved schedules', { 
      count: paginatedItems.length,
      totalCount,
      page,
      filters: queryParams
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'ETag': etag,
        'Cache-Control': `public, max-age=${CACHE_TTL.SCHEDULES}`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(response)
    };
    
  } catch (error) {
    logError('Failed to get schedules', { error: error.message, stack: error.stack });
    return errorResponse(500, 'Failed to retrieve schedules');
  }
};

/**
 * GET /public/schedules/{scheduleId}
 * Get specific schedule details
 */
module.exports.getSchedule = async (event) => {
  try {
    const scheduleId = event.pathParameters?.scheduleId;
    
    if (!scheduleId) {
      logWarn('Missing scheduleId parameter');
      return errorResponse(400, 'Schedule ID is required');
    }
    
    logInfo('Getting schedule details', { scheduleId });
    
    const params = {
      TableName: SCHEDULES_TABLE,
      Key: {
        ScheduleID: scheduleId
      }
    };
    
    const command = new GetCommand(params);
    const result = await dynamodb.send(command);
    
    if (!result.Item) {
      logWarn('Schedule not found', { scheduleId });
      return errorResponse(404, 'Schedule not found');
    }
    
    // Generate ETag for caching
    const etag = generateETag(result.Item);
    
    // Check if client has cached version
    const clientETag = event.headers['If-None-Match'];
    if (clientETag === etag) {
      return {
        statusCode: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': `public, max-age=${CACHE_TTL.SCHEDULE_DETAILS}`
        }
      };
    }
    
    logInfo('Successfully retrieved schedule', { scheduleId });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'ETag': etag,
        'Cache-Control': `public, max-age=${CACHE_TTL.SCHEDULE_DETAILS}`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        data: result.Item,
        meta: {
          cached: false,
          timestamp: new Date().toISOString()
        }
      })
    };
    
  } catch (error) {
    logError('Failed to get schedule', { error: error.message, stack: error.stack });
    return errorResponse(500, 'Failed to retrieve schedule');
  }
};