const Redis = require('ioredis');
const {
  error: logError, warn: logWarn, info: logInfo, debug: logDebug,
} = require('../utils/logger');

/**
 * Redis Service for caching functionality
 * Provides persistent connection and common Redis operations
 */
class RedisService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis connection
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnected && this.redis) {
      return;
    }

    try {
      // Use REDIS_URL if available, otherwise construct from individual env vars
      const redisUrl = process.env.REDIS_URL;
      const redisHost = process.env.REDIS_HOST || process.env.REDIS_ENDPOINT || 'localhost';
      const redisPort = process.env.REDIS_PORT || process.env.REDIS_PORT_REF || 6379;

      if (redisUrl) {
        this.redis = new Redis(redisUrl);
        logInfo('Redis connecting with URL', { url: redisUrl.replace(/:[^:]*@/, ':***@') });
      } else {
        this.redis = new Redis({
          host: redisHost,
          port: parseInt(redisPort, 10),
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
        logInfo('Redis connecting', { host: redisHost, port: redisPort });
      }

      // Handle connection events
      this.redis.on('connect', () => {
        this.isConnected = true;
        logInfo('Redis connected successfully');
      });

      this.redis.on('error', (error) => {
        this.isConnected = false;
        logError('Redis connection error', { error: error.message });
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        logWarn('Redis connection closed');
      });

      // Test the connection
      await this.redis.ping();
      this.isConnected = true;
    } catch (error) {
      logError('Failed to connect to Redis', { error: error.message });
      // Don't throw error - allow application to continue without cache
      this.isConnected = false;
    }
  }

  /**
   * Get value from Redis
   * @param {string} key - Cache key
   * @returns {Promise<string|null>} - Cached value or null
   */
  async get(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.isConnected) {
        logWarn('Redis not available, skipping get operation', { key });
        return null;
      }

      const value = await this.redis.get(key);
      logDebug('Redis GET', { key, found: !!value });
      return value;
    } catch (error) {
      logError('Redis GET error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value in Redis with optional expiration
   * @param {string} key - Cache key
   * @param {string} value - Value to cache
   * @param {number} [expireSeconds] - Expiration time in seconds
   * @returns {Promise<boolean>} - Success status
   */
  async set(key, value, expireSeconds = null) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.isConnected) {
        logWarn('Redis not available, skipping set operation', { key });
        return false;
      }

      if (expireSeconds) {
        await this.redis.setex(key, expireSeconds, value);
        logDebug('Redis SET with expiration', { key, expireSeconds });
      } else {
        await this.redis.set(key, value);
        logDebug('Redis SET', { key });
      }

      return true;
    } catch (error) {
      logError('Redis SET error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete key from Redis
   * @param {string} key - Cache key to delete
   * @returns {Promise<boolean>} - Success status
   */
  async del(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.isConnected) {
        logWarn('Redis not available, skipping delete operation', { key });
        return false;
      }

      const result = await this.redis.del(key);
      logDebug('Redis DELETE', { key, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logError('Redis DELETE error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Check if key exists in Redis
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Existence status
   */
  async exists(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.isConnected) {
        return false;
      }

      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logError('Redis EXISTS error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Close Redis connection
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      logInfo('Redis disconnected');
    }
  }
}

// Create singleton instance
const redisService = new RedisService();

// Export convenience methods
module.exports = {
  get: (key) => redisService.get(key),
  set: (key, value, expireSeconds) => redisService.set(key, value, expireSeconds),
  del: (key) => redisService.del(key),
  exists: (key) => redisService.exists(key),
  disconnect: () => redisService.disconnect(),

  // Export the service instance for advanced usage
  service: redisService,
};
