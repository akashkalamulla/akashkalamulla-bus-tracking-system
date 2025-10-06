const AWS = require('aws-sdk');
const Redis = require('ioredis');
const crypto = require('crypto');
const { logger } = require('../../utils/logger');
const { successResponse, errorResponse } = require('../../utils/response');
const { withRateLimit, addRateLimitHeaders } = require('../../utils/rate-limiter');

// Initialize services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
  retryDelayOnFailure: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

const ROUTES_TABLE = process.env.ROUTES_TABLE || 'BusRoutes';
const BUSES_TABLE = process.env.BUSES_TABLE || 'Buses';
const LOCATIONS_TABLE = process.env.LOCATIONS_TABLE || 'BusLocations';

// Cache TTL settings (aggressive caching for public data)
const CACHE_TTL = {
  ROUTES: 3600,        // 1 hour for routes (rarely change)
  LIVE_BUSES: 30,      // 30 seconds for live bus data
  BUS_DETAILS: 300,    // 5 minutes for bus details
  ROUTE_STATS: 600     // 10 minutes for route statistics
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
    hasPrev
  };
  
  if (hasNext) {
    pagination.nextPage = `${baseUrl}?page=${page + 1}&limit=${limit}`;
  }
  
  if (hasPrev) {
    pagination.prevPage = `${baseUrl}?page=${page - 1}&limit=${limit}`;
  }
  
  return {
    data: items,
    pagination,
    meta: {
      cached: true,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Check if client has cached version using ETag
 */
function checkClientCache(event, etag) {
  const clientETag = event.headers['If-None-Match'];
  return clientETag === etag;
}

/**
 * Create response with caching headers
 */
function createCachedResponse(data, ttl = 300, rateLimitInfo = null) {
  const etag = generateETag(data);
  
  let headers = {
    'Content-Type': 'application/json',
    'Cache-Control': `public, max-age=${ttl}`,
    'ETag': etag,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,If-None-Match',
    'Access-Control-Expose-Headers': 'ETag,X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset'
  };
  
  // Add rate limit headers if provided
  if (rateLimitInfo) {
    headers = addRateLimitHeaders(headers, rateLimitInfo);
  }
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(data)
  };
}

/**
 * Create 304 Not Modified response
 */
function createNotModifiedResponse() {
  return {
    statusCode: 304,
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*'
    },
    body: ''
  };
}

/**
 * GET /public/routes
 * Get all routes with pagination and aggressive caching
 */
async function getRoutes(event) {
  try {
    const { limit, page, offset } = parsePaginationParams(event);
    const cacheKey = `public:routes:page:${page}:limit:${limit}`;
    
    // Check Redis cache first
    let cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      const data = JSON.parse(cachedData);
      const etag = generateETag(data);
      
      // Check client-side cache
      if (checkClientCache(event, etag)) {
        logger.info('Client cache hit for routes', { page, limit });
        return createNotModifiedResponse();
      }
      
      logger.info('Redis cache hit for routes', { page, limit });
      return createCachedResponse(data, CACHE_TTL.ROUTES);
    }
    
    // Get total count for pagination
    const countParams = {
      TableName: ROUTES_TABLE,
      Select: 'COUNT'
    };
    
    const countResult = await dynamodb.scan(countParams).promise();
    const totalCount = countResult.Count;
    
    // Get paginated routes
    const params = {
      TableName: ROUTES_TABLE,
      Limit: limit
    };
    
    // Handle pagination with LastEvaluatedKey
    if (offset > 0) {
      // For simplicity, we'll use scan with limit
      // In production, consider using GSI with better pagination support
      params.ExclusiveStartKey = undefined; // Simplified for demo
    }
    
    const result = await dynamodb.scan(params).promise();
    
    // Create paginated response
    const baseUrl = `${event.requestContext.domainName}${event.requestContext.path}`;
    const responseData = createPaginatedResponse(
      result.Items,
      totalCount,
      page,
      limit,
      baseUrl
    );
    
    // Cache for 1 hour (routes don't change frequently)
    await redis.setex(cacheKey, CACHE_TTL.ROUTES, JSON.stringify(responseData));
    
    // Also cache a general routes list
    const allRoutesKey = 'public:routes:all';
    await redis.setex(allRoutesKey, CACHE_TTL.ROUTES, JSON.stringify(result.Items));
    
    logger.info('Routes retrieved and cached', { 
      page, 
      limit, 
      totalCount, 
      returned: result.Items.length 
    });
    
    return createCachedResponse(responseData, CACHE_TTL.ROUTES);
    
  } catch (error) {
    logger.error('Error getting routes:', error);
    return errorResponse(500, 'Failed to retrieve routes');
  }
}

/**
 * GET /public/routes/{routeId}
 * Get specific route details with caching
 */
async function getRoute(event) {
  try {
    const routeId = event.pathParameters.routeId;
    const cacheKey = `public:route:${routeId}`;
    
    // Check Redis cache first
    let cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      const data = JSON.parse(cachedData);
      const etag = generateETag(data);
      
      // Check client-side cache
      if (checkClientCache(event, etag)) {
        logger.info('Client cache hit for route', { routeId });
        return createNotModifiedResponse();
      }
      
      logger.info('Redis cache hit for route', { routeId });
      return createCachedResponse(data, CACHE_TTL.ROUTES);
    }
    
    // Get from DynamoDB
    const params = {
      TableName: ROUTES_TABLE,
      Key: { RouteID: routeId }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
      return errorResponse(404, 'Route not found');
    }
    
    // Enhance with route statistics
    const routeStats = await getRouteStatistics(routeId);
    const responseData = {
      ...result.Item,
      statistics: routeStats,
      meta: {
        cached: true,
        timestamp: new Date().toISOString()
      }
    };
    
    // Cache for 1 hour
    await redis.setex(cacheKey, CACHE_TTL.ROUTES, JSON.stringify(responseData));
    
    logger.info('Route retrieved and cached', { routeId });
    
    return createCachedResponse(responseData, CACHE_TTL.ROUTES);
    
  } catch (error) {
    logger.error('Error getting route:', error);
    return errorResponse(500, 'Failed to retrieve route');
  }
}

/**
 * GET /public/routes/{routeId}/buses/live
 * Get live buses on route with aggressive caching
 */
async function getLiveBuses(event) {
  try {
    const routeId = event.pathParameters.routeId;
    const cacheKey = `public:live:buses:${routeId}`;
    
    // Check Redis cache first (short TTL for live data)
    let cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      const data = JSON.parse(cachedData);
      const etag = generateETag(data);
      
      // Check client-side cache with shorter TTL
      const clientETag = event.headers['If-None-Match'];
      if (clientETag === etag) {
        logger.info('Client cache hit for live buses', { routeId });
        return createNotModifiedResponse();
      }
      
      logger.info('Redis cache hit for live buses', { routeId });
      return createCachedResponse(data, CACHE_TTL.LIVE_BUSES);
    }
    
    // Get buses on this route
    const busParams = {
      TableName: BUSES_TABLE,
      FilterExpression: 'RouteID = :routeId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'Status'
      },
      ExpressionAttributeValues: {
        ':routeId': routeId,
        ':status': 'ACTIVE'
      }
    };
    
    const busResult = await dynamodb.scan(busParams).promise();
    
    if (busResult.Items.length === 0) {
      const emptyResponse = {
        routeId,
        buses: [],
        count: 0,
        meta: {
          message: 'No active buses on this route',
          timestamp: new Date().toISOString()
        }
      };
      
      // Cache empty result for shorter time
      await redis.setex(cacheKey, 60, JSON.stringify(emptyResponse));
      return createCachedResponse(emptyResponse, 60);
    }
    
    // Get latest locations for each bus
    const liveBuses = [];
    const locationPromises = busResult.Items.map(async (bus) => {
      try {
        // Get latest location from cache first
        const locationCacheKey = `bus:location:${bus.BusID}`;
        let location = await redis.get(locationCacheKey);
        
        if (!location) {
          // Get from DynamoDB if not in cache
          const locationParams = {
            TableName: LOCATIONS_TABLE,
            KeyConditionExpression: 'BusID = :busId',
            ExpressionAttributeValues: {
              ':busId': bus.BusID
            },
            ScanIndexForward: false,
            Limit: 1
          };
          
          const locationResult = await dynamodb.query(locationParams).promise();
          location = locationResult.Items[0];
          
          if (location) {
            // Cache location for 1 minute
            await redis.setex(locationCacheKey, 60, JSON.stringify(location));
          }
        } else {
          location = JSON.parse(location);
        }
        
        if (location) {
          // Check if location is recent (within 10 minutes)
          const locationTime = new Date(location.timestamp);
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          
          if (locationTime > tenMinutesAgo) {
            liveBuses.push({
              busId: bus.BusID,
              busNumber: bus.BusNumber,
              capacity: bus.Capacity,
              location: {
                latitude: location.latitude,
                longitude: location.longitude,
                heading: location.heading,
                speed: location.speed,
                timestamp: location.timestamp,
                accuracy: location.accuracy
              },
              status: bus.Status,
              lastUpdate: location.timestamp
            });
          }
        }
      } catch (error) {
        logger.warn('Error getting bus location', { busId: bus.BusID, error: error.message });
      }
    });
    
    await Promise.all(locationPromises);
    
    const responseData = {
      routeId,
      buses: liveBuses,
      count: liveBuses.length,
      totalBusesOnRoute: busResult.Items.length,
      meta: {
        cached: true,
        timestamp: new Date().toISOString(),
        dataFreshness: '10 minutes'
      }
    };
    
    // Cache for 30 seconds (live data needs frequent updates)
    await redis.setex(cacheKey, CACHE_TTL.LIVE_BUSES, JSON.stringify(responseData));
    
    logger.info('Live buses retrieved and cached', { 
      routeId, 
      liveBuses: liveBuses.length,
      totalBuses: busResult.Items.length
    });
    
    return createCachedResponse(responseData, CACHE_TTL.LIVE_BUSES);
    
  } catch (error) {
    logger.error('Error getting live buses:', error);
    return errorResponse(500, 'Failed to retrieve live bus data');
  }
}

/**
 * GET /public/routes/search
 * Search routes by name or location with pagination
 */
async function searchRoutes(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const searchTerm = queryParams.q || '';
    const { limit, page, offset } = parsePaginationParams(event);
    
    if (!searchTerm || searchTerm.length < 2) {
      return errorResponse(400, 'Search term must be at least 2 characters');
    }
    
    const cacheKey = `public:routes:search:${encodeURIComponent(searchTerm)}:page:${page}:limit:${limit}`;
    
    // Check cache first
    let cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      const data = JSON.parse(cachedData);
      const etag = generateETag(data);
      
      if (checkClientCache(event, etag)) {
        logger.info('Client cache hit for route search', { searchTerm, page, limit });
        return createNotModifiedResponse();
      }
      
      logger.info('Redis cache hit for route search', { searchTerm, page, limit });
      return createCachedResponse(data, CACHE_TTL.ROUTES);
    }
    
    // Search in DynamoDB (simplified - in production use ElasticSearch)
    const params = {
      TableName: ROUTES_TABLE,
      FilterExpression: 'contains(RouteName, :searchTerm) OR contains(StartLocation, :searchTerm) OR contains(EndLocation, :searchTerm)',
      ExpressionAttributeValues: {
        ':searchTerm': searchTerm
      }
    };
    
    const result = await dynamodb.scan(params).promise();
    
    // Apply pagination to results
    const startIndex = offset;
    const endIndex = startIndex + limit;
    const paginatedItems = result.Items.slice(startIndex, endIndex);
    
    const baseUrl = `${event.requestContext.domainName}${event.requestContext.path}`;
    const responseData = createPaginatedResponse(
      paginatedItems,
      result.Items.length,
      page,
      limit,
      baseUrl
    );
    
    responseData.meta.searchTerm = searchTerm;
    responseData.meta.totalMatches = result.Items.length;
    
    // Cache search results for 10 minutes
    await redis.setex(cacheKey, 600, JSON.stringify(responseData));
    
    logger.info('Route search completed and cached', { 
      searchTerm, 
      matches: result.Items.length,
      page,
      limit
    });
    
    return createCachedResponse(responseData, 600);
    
  } catch (error) {
    logger.error('Error searching routes:', error);
    return errorResponse(500, 'Failed to search routes');
  }
}

/**
 * GET /public/stats
 * Get public statistics with caching
 */
async function getPublicStats(event) {
  try {
    const cacheKey = 'public:stats:overview';
    
    // Check cache first
    let cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      const data = JSON.parse(cachedData);
      const etag = generateETag(data);
      
      if (checkClientCache(event, etag)) {
        logger.info('Client cache hit for public stats');
        return createNotModifiedResponse();
      }
      
      logger.info('Redis cache hit for public stats');
      return createCachedResponse(data, CACHE_TTL.ROUTE_STATS);
    }
    
    // Get statistics from DynamoDB
    const [routeCount, busCount, activeBusCount] = await Promise.all([
      // Count total routes
      dynamodb.scan({ TableName: ROUTES_TABLE, Select: 'COUNT' }).promise(),
      
      // Count total buses
      dynamodb.scan({ TableName: BUSES_TABLE, Select: 'COUNT' }).promise(),
      
      // Count active buses
      dynamodb.scan({
        TableName: BUSES_TABLE,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'Status' },
        ExpressionAttributeValues: { ':status': 'ACTIVE' },
        Select: 'COUNT'
      }).promise()
    ]);
    
    const responseData = {
      statistics: {
        totalRoutes: routeCount.Count,
        totalBuses: busCount.Count,
        activeBuses: activeBusCount.Count,
        systemUptime: process.uptime(),
        lastUpdated: new Date().toISOString()
      },
      meta: {
        cached: true,
        timestamp: new Date().toISOString()
      }
    };
    
    // Cache for 10 minutes
    await redis.setex(cacheKey, CACHE_TTL.ROUTE_STATS, JSON.stringify(responseData));
    
    logger.info('Public stats retrieved and cached', responseData.statistics);
    
    return createCachedResponse(responseData, CACHE_TTL.ROUTE_STATS);
    
  } catch (error) {
    logger.error('Error getting public stats:', error);
    return errorResponse(500, 'Failed to retrieve statistics');
  }
}

/**
 * Helper function to get route statistics
 */
async function getRouteStatistics(routeId) {
  const cacheKey = `route:stats:${routeId}`;
  
  try {
    // Check cache first
    let cachedStats = await redis.get(cacheKey);
    if (cachedStats) {
      return JSON.parse(cachedStats);
    }
    
    // Get buses on route
    const busParams = {
      TableName: BUSES_TABLE,
      FilterExpression: 'RouteID = :routeId',
      ExpressionAttributeValues: {
        ':routeId': routeId
      },
      Select: 'COUNT'
    };
    
    const activeBusParams = {
      TableName: BUSES_TABLE,
      FilterExpression: 'RouteID = :routeId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'Status'
      },
      ExpressionAttributeValues: {
        ':routeId': routeId,
        ':status': 'ACTIVE'
      },
      Select: 'COUNT'
    };
    
    const [totalBuses, activeBuses] = await Promise.all([
      dynamodb.scan(busParams).promise(),
      dynamodb.scan(activeBusParams).promise()
    ]);
    
    const stats = {
      totalBuses: totalBuses.Count,
      activeBuses: activeBuses.Count,
      lastUpdated: new Date().toISOString()
    };
    
    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(stats));
    
    return stats;
    
  } catch (error) {
    logger.warn('Error getting route statistics', { routeId, error: error.message });
    return {
      totalBuses: 0,
      activeBuses: 0,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = {
  getRoutes: withRateLimit(getRoutes, 'PUBLIC'),
  getRoute: withRateLimit(getRoute, 'PUBLIC'),
  getLiveBuses: withRateLimit(getLiveBuses, 'PUBLIC'),
  searchRoutes: withRateLimit(searchRoutes, 'SEARCH'),
  getPublicStats: withRateLimit(getPublicStats, 'PUBLIC')
};