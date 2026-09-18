const Redis = require('ioredis');

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
};

const redisConnection = new Redis(redisOptions);

module.exports = {
  redisOptions,
  redisConnection,
};
