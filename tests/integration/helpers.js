const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/infrastructure/database');
const { redisConnection } = require('../../src/infrastructure/redis');
const { analyticsQueue } = require('../../src/infrastructure/queue');

const API_PREFIX = '/api/v1';
const fixtureId = crypto.randomUUID();
const userIds = new Set();
const urlIds = new Set();
const redisKeys = new Set();

const uniqueValue = (prefix) =>
  `${prefix}-${fixtureId.slice(0, 8)}-${crypto.randomBytes(4).toString('hex')}`;

const uniqueSlug = (prefix) =>
  `${prefix.slice(0, 8)}-${crypto.randomBytes(5).toString('hex')}`;

const registerUser = async (overrides = {}) => {
  const user = {
    name: overrides.name || 'Integration Tester',
    email: overrides.email || `${uniqueValue('tester')}@example.com`,
    password: overrides.password || 'password123',
  };
  const response = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send(user);

  if (response.statusCode === 201 && response.body.data?.user?.id) {
    userIds.add(response.body.data.user.id);
  }

  return { ...user, response };
};

const loginUser = async ({ email, password }) => {
  const response = await request(app)
    .post(`${API_PREFIX}/auth/login`)
    .send({ email, password });

  return { response, token: response.body.data?.token };
};

const createUrl = async (token, overrides = {}) => {
  const response = await request(app)
    .post(`${API_PREFIX}/urls`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      originalUrl: overrides.originalUrl || 'https://example.com',
      ...(overrides.customSlug ? { customSlug: overrides.customSlug } : {}),
    });

  if (response.statusCode === 201 && response.body.data?.id) {
    urlIds.add(response.body.data.id);
    redisKeys.add(`urls:${response.body.data.shortCode}`);
  }

  return response;
};

const trackUrl = (url) => {
  if (url?.id) urlIds.add(url.id);
  if (url?.shortCode) redisKeys.add(`urls:${url.shortCode}`);
};

const resetIntegrationRateLimit = async () => {
  await redisConnection.del(
    'ratelimit:auth-register:127.0.0.1',
    'ratelimit:public-api:127.0.0.1',
  );
};

const waitFor = async (callback, timeout = 5000, interval = 100) => {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const result = await callback();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Timed out while waiting for integration test condition.');
};

const cleanupFixtures = async () => {
  const trackedUrlIds = [...urlIds];
  const trackedUserIds = [...userIds];
  const trackedRedisKeys = [...redisKeys];

  const jobs = await analyticsQueue.getJobs([
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed',
  ]);
  await Promise.all(
    jobs
      .filter((job) => trackedUrlIds.includes(job.data?.urlId))
      .map((job) => job.remove()),
  );

  if (trackedRedisKeys.length > 0) {
    await redisConnection.del(...trackedRedisKeys);
  }
  if (trackedUrlIds.length > 0) {
    await prisma.url.deleteMany({ where: { id: { in: trackedUrlIds } } });
  }
  if (trackedUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: trackedUserIds } } });
  }

  urlIds.clear();
  userIds.clear();
  redisKeys.clear();
};

const closeTestConnections = async () => {
  await analyticsQueue.close();
  await prisma.$disconnect();
  await redisConnection.quit();
};

module.exports = {
  API_PREFIX,
  app,
  prisma,
  redisConnection,
  uniqueValue,
  uniqueSlug,
  registerUser,
  loginUser,
  createUrl,
  trackUrl,
  resetIntegrationRateLimit,
  waitFor,
  cleanupFixtures,
  closeTestConnections,
};
