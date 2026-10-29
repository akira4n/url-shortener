const { Worker } = require('bullmq');
const { redisOptions } = require('../../infrastructure/redis');
const { logger } = require('../../infrastructure/logger');
const analyticsRepository = require('./analytics.repository');
const { parseUserAgent } = require('../../utils/ua-parser');

const processor = async (job) => {
  const { urlId, ipAddress, userAgent, referer, clickedAt } = job.data;
  const { browser, os, deviceType } = parseUserAgent(userAgent);

  await analyticsRepository.createClickLog({
    urlId,
    ipAddress,
    referer,
    clickedAt: clickedAt ? new Date(clickedAt) : new Date(),
    browser,
    os,
    deviceType,
  });
};

const worker = new Worker('analytics-queue', processor, {
  connection: redisOptions,
  concurrency: 5,
});

worker.on('failed', (job, err) => {
  logger.error({ err, jobId: job?.id }, 'Click analytics job failed');
});

worker.on('error', (err) => {
  logger.error({ err }, 'Click analytics worker connection error');
});

module.exports = worker;
