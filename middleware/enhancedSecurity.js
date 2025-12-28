const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const ExpressBrute = require('express-brute');
const RedisStore = require('express-brute-redis');
const securityService = require('../services/securityService');
const logger = require('../services/loggerService');

// HTTPS Enforcement
const httpsOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }
  next();
};

// Enhanced Rate Limiting with Redis
const createAdvancedRateLimit = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator: (req) => {
      return req.ip + ':' + (req.user?.id || 'anonymous');
    },
    onLimitReached: (req, res, options) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userId: req.user?.id,
        endpoint: req.originalUrl,
        limit: max,
        window: windowMs
      });
    }
  });
};

// Brute Force Protection
const bruteForceStore = new RedisStore({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD
});

const bruteForce = new ExpressBrute(bruteForceStore, {
  freeRetries: 5,
  minWait: 5 * 60 * 1000, // 5 minutes
  maxWait: 60 * 60 * 1000, // 1 hour
  lifetime: 24 * 60 * 60, // 24 hours
  failCallback: (req, res, next, nextValidRequestDate) => {
    logger.warn('Brute force attack detected', {
      ip: req.ip,
      endpoint: req.originalUrl,
      nextValidRequest: nextValidRequestDate
    });
    
    res.status(429).json({
      error: 'Too many failed attempts',
      nextValidRequestDate
    });
  }
});

// API Key Authentication
const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const keyData = await securityService.validateApiKey(apiKey);
    
    if (!keyData) {
      await securityService.logSecurityEvent('invalid_api_key', null, {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        attempted_key: apiKey.substring(0, 8) + '...'
      });
      
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.apiKey = keyData;
    req.user = { id: keyData.userId };
    next();
  } catch (error) {
    logger.error('API key authentication failed', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Session Security
const secureSession = (req, res, next) => {
  // Set secure session cookies
  if (req.session) {
    req.session.cookie.secure = process.env.NODE_ENV === 'production';
    req.session.cookie.httpOnly = true;
    req.session.cookie.sameSite = 'strict';
    req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
  }
  
  next();
};

// CSRF Protection
const csrfProtection = (req, res, next) => {
  if (req.method === 'GET') {
    // Generate CSRF token for GET requests
    const csrfToken = securityService.generateCSRFToken();
    req.session.csrfToken = csrfToken;
    res.locals.csrfToken = csrfToken;
    return next();
  }

  // Validate CSRF token for state-changing requests
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session.csrfToken;

  if (!token || !sessionToken || !securityService.validateCSRFToken(token, sessionToken)) {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      userId: req.user?.id,
      endpoint: req.originalUrl
    });
    
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

// Input Sanitization
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = securityService.sanitizeInput(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

// Security Headers
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self'; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "media-src 'self'; " +
    "frame-src 'none';"
  );
  
  // HSTS (HTTP Strict Transport Security)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

// Audit Logging Middleware
const auditLogger = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log security-relevant events
    if (req.originalUrl.includes('/auth/') || 
        req.originalUrl.includes('/admin/') ||
        res.statusCode >= 400) {
      
      securityService.logSecurityEvent('api_request', req.user?.id, {
        method: req.method,
        url: req.originalUrl,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        status_code: res.statusCode,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Slow Down Middleware (Progressive Delay)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: () => 500, // Fixed delay of 500ms per request
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  validate: { delayMs: false } // Disable warning
});

module.exports = {
  httpsOnly,
  createAdvancedRateLimit,
  bruteForce,
  apiKeyAuth,
  secureSession,
  csrfProtection,
  sanitizeInput,
  securityHeaders,
  auditLogger,
  speedLimiter
};