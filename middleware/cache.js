const cacheService = require('../services/cacheService');
const logger = require('../services/loggerService');

const cacheMiddleware = (ttl = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator 
        ? keyGenerator(req) 
        : `api:${req.originalUrl}:${req.user?.id || 'anonymous'}`;

      // Try to get cached response
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        logger.debug('Cache hit', { key: cacheKey });
        return res.json(cachedResponse);
      }

      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data) {
        // Cache successful responses only
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, data, ttl).catch(err => {
            logger.error('Cache set failed', err, { key: cacheKey });
          });
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', error);
      next();
    }
  };
};

// Specific cache middleware for different endpoints
const cacheAnalytics = cacheMiddleware(300, (req) => {
  return `analytics:${req.originalUrl}:${req.query.period || 'default'}`;
});

const cacheDrivers = cacheMiddleware(60, (req) => {
  const { latitude, longitude, radius } = req.body || req.query;
  return `drivers:${latitude}:${longitude}:${radius || 10}`;
});

const cacheRides = cacheMiddleware(30, (req) => {
  return `rides:${req.originalUrl}:${req.user?.id}`;
});

const cacheUser = cacheMiddleware(600, (req) => {
  return `user_data:${req.user?.id}:${req.originalUrl}`;
});

// Cache invalidation middleware
const invalidateCache = (patterns) => {
  return async (req, res, next) => {
    // Store original methods
    const originalJson = res.json;
    const originalSend = res.send;

    const clearCaches = async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        for (const pattern of patterns) {
          try {
            const resolvedPattern = typeof pattern === 'function' 
              ? pattern(req) 
              : pattern;
            await cacheService.clearPattern(resolvedPattern);
            logger.debug('Cache invalidated', { pattern: resolvedPattern });
          } catch (error) {
            logger.error('Cache invalidation failed', error, { pattern });
          }
        }
      }
    };

    // Override response methods
    res.json = function(data) {
      clearCaches();
      return originalJson.call(this, data);
    };

    res.send = function(data) {
      clearCaches();
      return originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  cacheMiddleware,
  cacheAnalytics,
  cacheDrivers,
  cacheRides,
  cacheUser,
  invalidateCache
};