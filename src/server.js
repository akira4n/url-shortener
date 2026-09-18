require('dotenv/config');

const app = require('./app');
const { logger } = require('./infrastructure/logger');
const prisma = require('./infrastructure/database');
const { redisConnection } = require('./infrastructure/redis');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(
    `Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`,
  );
});

const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed.');

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
    logger.error('Forceful shutdown executed due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled Rejection');
  gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});
