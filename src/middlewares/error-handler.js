const { ZodError } = require('zod');
const { logger } = require('../infrastructure/logger');

const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err instanceof ZodError) {
    status = 400;
    message = err.issues?.[0]?.message || 'Invalid request payload';
  }

  if (status >= 500) {
    logger.error(err);
  }

  res.status(status).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;
