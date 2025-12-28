const winston = require('winston');
const path = require('path');

class LoggerService {
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'indrive-backend' },
      transports: [
        new winston.transports.File({ 
          filename: path.join(__dirname, '../logs/error.log'), 
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({ 
          filename: path.join(__dirname, '../logs/combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  error(message, error = null, meta = {}) {
    this.logger.error(message, { 
      error: error ? error.stack || error.message : null,
      ...meta 
    });
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  logRideEvent(event, rideId, userId, meta = {}) {
    this.info(`Ride ${event}`, {
      event,
      rideId,
      userId,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  logPaymentEvent(event, paymentId, amount, meta = {}) {
    this.info(`Payment ${event}`, {
      event,
      paymentId,
      amount,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  logUserEvent(event, userId, meta = {}) {
    this.info(`User ${event}`, {
      event,
      userId,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  logApiRequest(req, res, responseTime) {
    this.info('API Request', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    });
  }

  logDatabaseQuery(query, duration, rowCount) {
    this.debug('Database Query', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rowCount
    });
  }
}

module.exports = new LoggerService();