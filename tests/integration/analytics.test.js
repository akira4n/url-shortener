const request = require('supertest');
const { analyticsQueue } = require('../../src/infrastructure/queue');
const {
  API_PREFIX,
  app,
  prisma,
  registerUser,
  loginUser,
  createUrl,
  waitFor,
  resetIntegrationRateLimit,
  cleanupFixtures,
  closeTestConnections,
} = require('./helpers');

describe('Analytics and BullMQ integration tests', () => {
  let token;
  let analyticsWorker;

  beforeAll(async () => {
    await resetIntegrationRateLimit();
    analyticsWorker = require('../../src/modules/analytics/analytics.worker');
    const user = await registerUser();
    token = (await loginUser(user)).token;
  });

  afterAll(async () => {
    await analyticsWorker.close();
    await cleanupFixtures();
    await resetIntegrationRateLimit();
    await closeTestConnections();
  });

  it('publishes a redirect analytics event and persists it through the worker', async () => {
    const created = await createUrl(token, {
      originalUrl: 'https://example.com/analytics',
    });
    const { id, shortCode } = created.body.data;

    const response = await request(app)
      .get(`${API_PREFIX}/urls/${shortCode}`)
      .set('User-Agent', 'Mozilla/5.0 Chrome/120.0.0.0');

    expect(response.statusCode).toBe(302);

    const analytics = await waitFor(async () =>
      prisma.clickAnalytic.findFirst({
        where: { urlId: id },
      }),
    );

    expect(analytics).toEqual(
      expect.objectContaining({
        urlId: id,
        browser: expect.stringMatching(/^Chrome/),
      }),
    );
  });

  it('configures BullMQ jobs with the expected retry policy', () => {
    expect(analyticsQueue.opts.defaultJobOptions).toEqual(
      expect.objectContaining({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }),
    );
  });
});
