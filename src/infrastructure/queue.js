const { Queue } = require('bullmq');
const { redisOptions } = require('./redis');

const analyticsQueue = new Queue('analytics-queue', {
  connection: redisOptions,
});

module.exports = {
  analyticsQueue,
};
