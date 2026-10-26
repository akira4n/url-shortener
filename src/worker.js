require('dotenv/config');

const worker = require('./modules/analytics/analytics.worker');
const { logger } = require('./infrastructure/logger');
const prisma = require('./infrastructure/database');
const { redisConnection } = require('./infrastructure/redis');

logger.info('Analytics background worker process started...');

const shutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  worker.close().then(async () => {
    logger.info('Analytics worker closed.');

    try {
      await prisma.$disconnect();
      logger.info('Database connection closed.');

      await redisConnection.quit();
      logger.info('Redis connection closed.');

      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forceful worker shutdown executed due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled Rejection');
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught Exception');
  process.exit(1);
});
