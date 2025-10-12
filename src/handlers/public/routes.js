const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient, ScanCommand, GetCommand, QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
// const Redis = require('ioredis');
const crypto = require('crypto');
const {
  error: logError, warn: logWarn, info: logInfo, debug: logDebug,
} = require('../../utils/logger');
const { successResponse, errorResponse } = require('../../utils/response');

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

// Redis temporarily disabled
// const redis = new Redis({
//   host: process.env.REDIS_HOST,
//   port: process.env.REDIS_PORT || 6379,
//   retryDelayOnFailure: 100,
//   maxRetriesPerRequest: 3,
//   lazyConnect: true
// });

const ROUTES_TABLE = process.env.ROUTES_TABLE || 'BusRoutes';
const BUSES_TABLE = process.env.BUSES_TABLE || 'Buses';
const LOCATIONS_TABLE = process.env.LOCATIONS_TABLE || 'BusLocations';

// Debug environment variables
logInfo('Environment variables', {
  ROUTES_TABLE: process.env.ROUTES_TABLE,
  BUSES_TABLE: process.env.BUSES_TABLE,
  LOCATIONS_TABLE: process.env.LOCATIONS_TABLE,
  actual_ROUTES_TABLE: ROUTES_TABLE,
  actual_BUSES_TABLE: BUSES_TABLE,
  actual_LOCATIONS_TABLE: LOCATIONS_TABLE,
});

// Cache TTL settings (aggressive caching for public data)
const CACHE_TTL = {
  ROUTES: 3600, // 1 hour for routes (rarely change)
  LIVE_BUSES: 30, // 30 seconds for live bus data
  BUS_DETAILS: 300, // 5 minutes for bus details
  ROUTE_STATS: 600, // 10 minutes for route statistics
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

  let limit = parseInt(queryParams.limit, 10) || DEFAULT_PAGE_SIZE;
  limit = Math.min(limit, MAX_PAGE_SIZE); // Enforce max page size

  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
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
    hasPrev,
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
      timestamp: new Date().toISOString(),
    },
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
    ETag: etag,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,If-None-Match',
    'Access-Control-Expose-Headers': 'ETag,X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset',
  };

  // Add rate limit headers if provided
  if (rateLimitInfo) {
    headers = addRateLimitHeaders(headers, rateLimitInfo);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(data),
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
      'Access-Control-Allow-Origin': '*',
    },
    body: '',
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

    // Redis cache disabled - skip cache check
    const cachedData = null;

    if (cachedData) {
      const data = JSON.parse(cachedData);
      const etag = generateETag(data);

      // Check client-side cache
      if (checkClientCache(event, etag)) {
        logInfo('Client cache hit for routes', { page, limit });
        return createNotModifiedResponse();
      }

      logInfo('Redis cache hit for routes', { page, limit });
      return createCachedResponse(data, CACHE_TTL.ROUTES);
    }

    // Get total count for pagination
    const countParams = {
      TableName: ROUTES_TABLE,
      Select: 'COUNT',
    };

    const countResult = await dynamodb.send(new ScanCommand(countParams));
    const totalCount = countResult.Count;

    // Get paginated routes
    const params = {
      TableName: ROUTES_TABLE,
      Limit: limit,
    };

    // Handle pagination with LastEvaluatedKey
    if (offset > 0) {
      // For simplicity, we'll use scan with limit
      // In production, consider using GSI with better pagination support
      params.ExclusiveStartKey = undefined; // Simplified for demo
    }

    const result = await dynamodb.send(new ScanCommand(params));

    // Create paginated response
    const baseUrl = `${event.requestContext.domainName}${event.requestContext.path}`;
    const responseData = createPaginatedResponse(
      result.Items,
      totalCount,
      page,
      limit,
      baseUrl,
    );

    // Cache for 1 hour (routes don't change frequently)
    // Redis caching disabled

    // Also cache a general routes list
    const allRoutesKey = 'public:routes:all';
    // Redis caching disabled

    logInfo('Routes retrieved and cached', {
      page,
      limit,
      totalCount,
      returned: result.Items.length,
    });

    return createCachedResponse(responseData, CACHE_TTL.ROUTES);
  } catch (error) {
    logError('Error getting routes:', error);
    return errorResponse(500, 'Failed to retrieve routes');
  }
}

/**
 * GET /public/routes/{routeId}
 * Get specific route details with caching
 */
async function getRoute(event) {
  try {
    const { routeId } = event.pathParameters;
    const cacheKey = `public:route:${routeId}`;

    // Redis cache disabled - skip cache check
    const cachedData = null;

    if (cachedData) {
      const data = JSON.parse(cachedData);
      const etag = generateETag(data);

      // Check client-side cache
      if (checkClientCache(event, etag)) {
        logInfo('Client cache hit for route', { routeId });
        return createNotModifiedResponse();
      }

      logInfo('Redis cache hit for route', { routeId });
      return createCachedResponse(data, CACHE_TTL.ROUTES);
    }

    // Get from DynamoDB
    const params = {
      TableName: ROUTES_TABLE,
      Key: { RouteID: routeId },
    };

    const result = await dynamodb.send(new GetCommand(params));

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
        timestamp: new Date().toISOString(),
      },
    };

    // Cache for 1 hour
    // Redis caching disabled

    logInfo('Route retrieved and cached', { routeId });

    return createCachedResponse(responseData, CACHE_TTL.ROUTES);
  } catch (error) {
    logError('Error getting route:', error);
    return errorResponse(500, 'Failed to retrieve route');
  }
}

/**
 * GET /public/routes/{routeId}/buses/live
 * Get live buses on route with aggressive caching
 */
async function getLiveBuses(event) {
  try {
    const { routeId } = event.pathParameters;
    const cacheKey = `public:live:buses:${routeId}`;

    // Redis cache disabled - skip cache check
    const cachedData = null;

    if (cachedData) {
      const data = JSON.parse(cachedData);
      const etag = generateETag(data);

      // Check client-side cache with shorter TTL
      const clientETag = event.headers['If-None-Match'];
      if (clientETag === etag) {
        logInfo('Client cache hit for live buses', { routeId });
        return createNotModifiedResponse();
      }

      logInfo('Redis cache hit for live buses', { routeId });
      return createCachedResponse(data, CACHE_TTL.LIVE_BUSES);
    }

    // Get buses on this route
    const busParams = {
      TableName: BUSES_TABLE,
      FilterExpression: 'RouteID = :routeId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'Status',
      },
      ExpressionAttributeValues: {
        ':routeId': routeId,
        ':status': 'ACTIVE',
      },
    };

    const busResult = await dynamodb.send(new ScanCommand(busParams));

    if (busResult.Items.length === 0) {
      const emptyResponse = {
        routeId,
        buses: [],
        count: 0,
        meta: {
          message: 'No active buses on this route',
          timestamp: new Date().toISOString(),
        },
      };

      // Cache empty result for shorter time
      // Redis caching disabled
      return createCachedResponse(emptyResponse, 60);
    }

    // Get latest locations for each bus
    const liveBuses = [];
    const locationPromises = busResult.Items.map(async (bus) => {
      try {
        // Get latest location from cache first
        const locationCacheKey = `bus:location:${bus.BusID}`;
        // let location = await redis.get(); // Redis disabled

        if (!location) {
          // Get from DynamoDB if not in cache
          const locationParams = {
            TableName: LOCATIONS_TABLE,
            KeyConditionExpression: 'BusID = :busId',
            ExpressionAttributeValues: {
              ':busId': bus.BusID,
            },
            ScanIndexForward: false,
            Limit: 1,
          };

          const locationResult = await dynamodb.send(new QueryCommand());
          location = locationResult.Items[0];

          if (location) {
            // Cache location for 1 minute
            // Redis caching disabled
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
                accuracy: location.accuracy,
              },
              status: bus.Status,
              lastUpdate: location.timestamp,
            });
          }
        }
      } catch (error) {
        logWarn('Error getting bus location', { busId: bus.BusID, error: error.message });
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
        dataFreshness: '10 minutes',
      },
    };

    // Cache for 30 seconds (live data needs frequent updates)
    // Redis caching disabled

    logInfo('Live buses retrieved and cached', {
      routeId,
      liveBuses: liveBuses.length,
      totalBuses: busResult.Items.length,
    });

    return createCachedResponse(responseData, CACHE_TTL.LIVE_BUSES);
  } catch (error) {
    logError('Error getting live buses:', error);
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

    logInfo('Search routes request', {
      searchTerm, page, limit, queryParams,
    });

    if (!searchTerm || searchTerm.length < 2) {
      return errorResponse(400, 'Search term must be at least 2 characters');
    }

    // Get all routes from DynamoDB
    const params = {
      TableName: ROUTES_TABLE,
    };

    const result = await dynamodb.send(new ScanCommand(params));

    if (!result.Items || result.Items.length === 0) {
      return successResponse({
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit,
          hasNext: false,
          hasPrevious: false,
        },
        meta: {
          searchTerm,
          totalMatches: 0,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Filter results in memory for case-insensitive search
    const searchTermLower = searchTerm.toLowerCase();
    const filteredResults = result.Items.filter((route) => {
      const routeName = (route.route_name || '').toLowerCase();
      const startLocation = (route.start_location || '').toLowerCase();
      const endLocation = (route.end_location || '').toLowerCase();
      const fromCity = (route.from_city || '').toLowerCase();
      const toCity = (route.to_city || '').toLowerCase();
      const description = (route.description || '').toLowerCase();

      return routeName.includes(searchTermLower)
             || startLocation.includes(searchTermLower)
             || endLocation.includes(searchTermLower)
             || fromCity.includes(searchTermLower)
             || toCity.includes(searchTermLower)
             || description.includes(searchTermLower);
    });

    // Apply pagination to filtered results
    const startIndex = offset;
    const endIndex = startIndex + limit;
    const paginatedItems = filteredResults.slice(startIndex, endIndex);

    // Calculate pagination info
    const totalPages = Math.ceil(filteredResults.length / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const responseData = {
      data: paginatedItems,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: filteredResults.length,
        itemsPerPage: limit,
        hasNext,
        hasPrevious: hasPrev,
      },
      links: {
        self: `/public/routes/search?q=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`,
        first: `/public/routes/search?q=${encodeURIComponent(searchTerm)}&page=1&limit=${limit}`,
        last: `/public/routes/search?q=${encodeURIComponent(searchTerm)}&page=${totalPages}&limit=${limit}`,
      },
      meta: {
        searchTerm,
        totalMatches: filteredResults.length,
        cached: false,
        timestamp: new Date().toISOString(),
      },
    };

    if (hasNext) {
      responseData.links.next = `/public/routes/search?q=${encodeURIComponent(searchTerm)}&page=${page + 1}&limit=${limit}`;
    }

    if (hasPrev) {
      responseData.links.prev = `/public/routes/search?q=${encodeURIComponent(searchTerm)}&page=${page - 1}&limit=${limit}`;
    }

    logInfo('Route search completed', {
      searchTerm,
      matches: filteredResults.length,
      page,
      limit,
      returned: paginatedItems.length,
    });

    return successResponse(responseData);
  } catch (error) {
    logError('Error searching routes:', error);
    return errorResponse(500, 'Failed to search routes');
  }
}

/**
 * Helper function to get route statistics
 */
async function getRouteStatistics(routeId) {
  const cacheKey = `route:stats:${routeId}`;

  try {
    // Redis cache disabled - skip cache check
    const cachedStats = null;
    if (cachedStats) {
      return JSON.parse(cachedStats);
    }

    // Get buses on route
    const busParams = {
      TableName: BUSES_TABLE,
      FilterExpression: 'RouteID = :routeId',
      ExpressionAttributeValues: {
        ':routeId': routeId,
      },
      Select: 'COUNT',
    };

    const activeBusParams = {
      TableName: BUSES_TABLE,
      FilterExpression: 'RouteID = :routeId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'Status',
      },
      ExpressionAttributeValues: {
        ':routeId': routeId,
        ':status': 'ACTIVE',
      },
      Select: 'COUNT',
    };

    const [totalBuses, activeBuses] = await Promise.all([
      dynamodb.send(new ScanCommand(busParams)),
      dynamodb.send(new ScanCommand(activeBusParams)),
    ]);

    const stats = {
      totalBuses: totalBuses.Count,
      activeBuses: activeBuses.Count,
      lastUpdated: new Date().toISOString(),
    };

    // Cache for 5 minutes
    // Redis caching disabled

    return stats;
  } catch (error) {
    logWarn('Error getting route statistics', { routeId, error: error.message });
    return {
      totalBuses: 0,
      activeBuses: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}

module.exports = {
  getRoutes: getRoutes,
  getRoute: getRoute,
  getLiveBuses: getLiveBuses,
  searchRoutes: searchRoutes,
};
