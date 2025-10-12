const Redis = require('ioredis');
const {
  error: logError, warn: logWarn, info: logInfo, debug: logDebug,
} = require('./logger');

// Rate limiting configuration
const RATE_LIMITS = {
  PUBLIC: {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: 100, // 100 requests per minute per IP
    message: 'Too many requests from this IP, please try again later',
  },
  SEARCH: {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: 30, // 30 search requests per minute per IP
    message: 'Too many search requests, please slow down',
  },
  OPERATOR: {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: 200, // 200 requests per minute per IP (higher for operators)
    message: 'Too many operator requests, please slow down',
  },
  ADMIN: {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: 300, // 300 requests per minute per IP (highest for admins)
    message: 'Too many admin requests, please slow down',
  },
};

// Initialize Redis for rate limiting
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
  retryDelayOnFailure: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

/**
 * Extract client IP from Lambda event
 */
function getClientIP(event) {
  // Try various headers in order of preference
  const headers = event.headers || {};

  return (
    headers['X-Forwarded-For']?.split(',')[0]?.trim()
    || headers['X-Real-IP']
    || headers['X-Client-IP']
    || event.requestContext?.identity?.sourceIp
    || 'unknown'
  );
}

/**
 * Check rate limit for a given IP and endpoint
 */
async function checkRateLimit(event, limitType = 'PUBLIC') {
  try {
    const ip = getClientIP(event);
    const config = RATE_LIMITS[limitType];
    const key = `rate_limit:${limitType}:${ip}`;

    // Get current count
    const current = await redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= config.maxRequests) {
      // Rate limit exceeded
      const ttl = await redis.ttl(key);
      const resetTime = new Date(Date.now() + (ttl * 1000));

      logWarn('Rate limit exceeded', {
        ip,
        limitType,
        count,
        maxRequests: config.maxRequests,
        resetTime,
      });

      return {
        allowed: false,
        count,
        maxRequests: config.maxRequests,
        resetTime,
        message: config.message,
      };
    }

    // Increment counter
    const newCount = await redis.incr(key);

    // Set expiration on first request
    if (newCount === 1) {
      await redis.expire(key, Math.ceil(config.windowMs / 1000));
    }

    const remaining = config.maxRequests - newCount;
    const ttl = await redis.ttl(key);
    const resetTime = new Date(Date.now() + (ttl * 1000));

    logDebug('Rate limit check passed', {
      ip,
      limitType,
      count: newCount,
      remaining,
      maxRequests: config.maxRequests,
    });

    return {
      allowed: true,
      count: newCount,
      remaining,
      maxRequests: config.maxRequests,
      resetTime,
    };
  } catch (error) {
    logError('Rate limit check failed', { error: error.message });
    // On error, allow the request (fail open)
    return {
      allowed: true,
      count: 0,
      remaining: 100,
      maxRequests: 100,
      resetTime: new Date(Date.now() + 60000),
    };
  }
}

/**
 * Add rate limit headers to response
 */
function addRateLimitHeaders(headers, rateLimitInfo) {
  return {
    ...headers,
    'X-RateLimit-Limit': rateLimitInfo.maxRequests.toString(),
    'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(rateLimitInfo.resetTime.getTime() / 1000).toString(),
  };
}

/**
 * Create rate limit exceeded response
 */
function createRateLimitResponse(rateLimitInfo) {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': Math.ceil((rateLimitInfo.resetTime.getTime() - Date.now()) / 1000).toString(),
      'X-RateLimit-Limit': rateLimitInfo.maxRequests.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': Math.floor(rateLimitInfo.resetTime.getTime() / 1000).toString(),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify({
      error: 'Rate limit exceeded',
      message: rateLimitInfo.message,
      retryAfter: Math.ceil((rateLimitInfo.resetTime.getTime() - Date.now()) / 1000),
    }),
  };
}

/**
 * Rate limiting middleware wrapper
 */
function withRateLimit(handler, limitType = 'PUBLIC') {
  return async (event, context) => {
    // Check rate limit
    const rateLimitInfo = await checkRateLimit(event, limitType);

    if (!rateLimitInfo.allowed) {
      return createRateLimitResponse(rateLimitInfo);
    }

    try {
      // Call the original handler
      const response = await handler(event, context);

      // Add rate limit headers to successful responses
      if (response.headers) {
        response.headers = addRateLimitHeaders(response.headers, rateLimitInfo);
      }

      return response;
    } catch (error) {
      // Even on error, we should add rate limit headers
      logError('Handler error with rate limiting', { error: error.message });
      throw error;
    }
  };
}

module.exports = {
  checkRateLimit,
  addRateLimitHeaders,
  createRateLimitResponse,
  withRateLimit,
  getClientIP,
};
