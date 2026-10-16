const { Queue } = require('bullmq');
const { redisOptions } = require('./redis');

const analyticsQueue = new Queue('analytics-queue', {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: 1000,
  },
});

module.exports = {
  analyticsQueue,
};
