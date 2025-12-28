const logger = require('../services/loggerService');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logApiRequest(req, res, duration);
  });
  
  next();
};

const errorLogger = (err, req, res, next) => {
  logger.error('API Error', err, {
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    body: req.body
  });
  
  next(err);
};

module.exports = { requestLogger, errorLogger };