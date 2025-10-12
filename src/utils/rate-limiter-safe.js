/**
 * Production-safe rate limiter that gracefully handles Redis failures
 * Falls back to no-op if Redis is unavailable
 */

const {
  error: logError, warn: logWarn, info: logInfo, debug: logDebug,
} = require('./logger');

// Simple in-memory fallback for development/testing
const inMemoryCache = new Map();
const CLEANUP_INTERVAL = 60000; // 1 minute

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of inMemoryCache.entries()) {
    if (data.expires < now) {
      inMemoryCache.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

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

// Initialize Redis only if environment indicates it should be used
let redis = null;
let redisAvailable = false;

async function initRedis() {
  // Only try to connect if we have Redis configuration
  const redisHost = process.env.REDIS_HOST;
  const redisUrl = process.env.REDIS_URL;

  if (!redisHost && !redisUrl) {
    logInfo('Redis not configured, using in-memory rate limiting');
    return;
  }

  try {
    const Redis = require('ioredis');

    if (redisUrl) {
      redis = new Redis(redisUrl);
    } else {
      redis = new Redis({
        host: redisHost,
        port: process.env.REDIS_PORT || 6379,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 2,
        lazyConnect: true,
      });
    }

    // Test connection
    await redis.ping();
    redisAvailable = true;
    logInfo('Redis rate limiter initialized successfully');
  } catch (error) {
    logWarn('Redis connection failed, falling back to in-memory rate limiting', {
      error: error.message,
    });
    redis = null;
    redisAvailable = false;
  }
}

/**
 * Extract client IP from Lambda event
 */
function getClientIP(event) {
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
 * In-memory rate limiting fallback
 */
async function checkRateLimitMemory(ip, limitType) {
  const config = RATE_LIMITS[limitType];
  const key = `rate_limit:${limitType}:${ip}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get or create entry
  let entry = inMemoryCache.get(key);
  if (!entry) {
    entry = { count: 0, expires: now + config.windowMs, requests: [] };
    inMemoryCache.set(key, entry);
  }

  // Remove old requests
  entry.requests = entry.requests.filter((time) => time > windowStart);
  entry.count = entry.requests.length;

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      count: entry.count,
      maxRequests: config.maxRequests,
      resetTime: new Date(entry.expires),
      message: config.message,
    };
  }

  // Add current request
  entry.requests.push(now);
  entry.count = entry.requests.length;

  return {
    allowed: true,
    count: entry.count,
    remaining: config.maxRequests - entry.count,
    maxRequests: config.maxRequests,
    resetTime: new Date(entry.expires),
  };
}

/**
 * Redis-based rate limiting
 */
async function checkRateLimitRedis(ip, limitType) {
  const config = RATE_LIMITS[limitType];
  const key = `rate_limit:${limitType}:${ip}`;

  try {
    // Get current count
    const current = await redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= config.maxRequests) {
      const ttl = await redis.ttl(key);
      const resetTime = new Date(Date.now() + (ttl * 1000));

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

    return {
      allowed: true,
      count: newCount,
      remaining,
      maxRequests: config.maxRequests,
      resetTime,
    };
  } catch (error) {
    logError('Redis rate limit check failed, falling back to memory', { error: error.message });
    redisAvailable = false;
    return await checkRateLimitMemory(ip, limitType);
  }
}

/**
 * Check rate limit for a given IP and endpoint
 */
async function checkRateLimit(event, limitType = 'PUBLIC') {
  const ip = getClientIP(event);

  // Initialize Redis on first use if not already done
  if (redis === null && redisAvailable === false && (process.env.REDIS_HOST || process.env.REDIS_URL)) {
    await initRedis();
  }

  // Use Redis if available, otherwise fall back to memory
  if (redisAvailable && redis) {
    return await checkRateLimitRedis(ip, limitType);
  }
  return await checkRateLimitMemory(ip, limitType);
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
 * Rate limiting middleware wrapper - PRODUCTION SAFE
 * Will not fail if Redis is unavailable
 */
function withRateLimit(handler, limitType = 'PUBLIC') {
  return async (event, context) => {
    try {
      // Check rate limit
      const rateLimitInfo = await checkRateLimit(event, limitType);

      if (!rateLimitInfo.allowed) {
        return createRateLimitResponse(rateLimitInfo);
      }

      // Call the original handler
      const response = await handler(event, context);

      // Add rate limit headers to successful responses
      if (response.headers) {
        response.headers = addRateLimitHeaders(response.headers, rateLimitInfo);
      }

      return response;
    } catch (rateLimitError) {
      // If rate limiting fails completely, log and continue without rate limiting
      logError('Rate limiting failed completely, allowing request', {
        error: rateLimitError.message,
      });

      try {
        return await handler(event, context);
      } catch (handlerError) {
        // Re-throw handler errors normally
        throw handlerError;
      }
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
