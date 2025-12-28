const Redis = require('ioredis');
const logger = require('./loggerService');

class CacheService {
  constructor() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 5000
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
      });

      this.redis.on('error', (err) => {
        logger.error('Redis connection error', err);
        this.isConnected = false;
      });
      
      this.isConnected = false;
    } catch (error) {
      console.log('⚠️  Redis not available - caching disabled');
      this.isConnected = false;
    }
  }

  async get(key) {
    if (!this.isConnected) return null;
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error', error, { key });
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isConnected) return false;
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error', error, { key });
      return false;
    }
  }

  async del(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error', error, { key });
      return false;
    }
  }

  async exists(key) {
    try {
      return await this.redis.exists(key);
    } catch (error) {
      logger.error('Cache exists error', error, { key });
      return false;
    }
  }

  // Cache nearby drivers for 30 seconds
  async cacheNearbyDrivers(lat, lng, radius, drivers) {
    const key = `nearby_drivers:${lat}:${lng}:${radius}`;
    await this.set(key, drivers, 30);
  }

  async getNearbyDrivers(lat, lng, radius) {
    const key = `nearby_drivers:${lat}:${lng}:${radius}`;
    return await this.get(key);
  }

  // Cache user data for 1 hour
  async cacheUser(userId, userData) {
    const key = `user:${userId}`;
    await this.set(key, userData, 3600);
  }

  async getUser(userId) {
    const key = `user:${userId}`;
    return await this.get(key);
  }

  // Cache ride data for 10 minutes
  async cacheRide(rideId, rideData) {
    const key = `ride:${rideId}`;
    await this.set(key, rideData, 600);
  }

  async getRide(rideId) {
    const key = `ride:${rideId}`;
    return await this.get(key);
  }

  // Cache analytics for 5 minutes
  async cacheAnalytics(type, period, data) {
    const key = `analytics:${type}:${period}`;
    await this.set(key, data, 300);
  }

  async getAnalytics(type, period) {
    const key = `analytics:${type}:${period}`;
    return await this.get(key);
  }

  // Session management
  async setSession(sessionId, userData, ttl = 86400) {
    const key = `session:${sessionId}`;
    await this.set(key, userData, ttl);
  }

  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.get(key);
  }

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    await this.del(key);
  }

  // Rate limiting
  async checkRateLimit(identifier, limit, window) {
    const key = `rate_limit:${identifier}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }
    
    return current <= limit;
  }

  // Clear cache patterns
  async clearPattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      logger.error('Cache clear pattern error', error, { pattern });
      return 0;
    }
  }
}

module.exports = new CacheService();