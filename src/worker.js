require('dotenv/config');

const worker = require('./modules/analytics/analytics.worker');
const { logger } = require('./infrastructure/logger');
const prisma = require('./infrastructure/database');
const { redisConnection } = require('./infrastructure/redis');

logger.info('Analytics background worker process started...');

let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info(`Received ${signal}. Closing worker and connections...`);

  try {
    await worker.close();
    await prisma.$disconnect();
    await redisConnection.quit();

    logger.info('Worker process gracefully terminated.');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during worker shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});
