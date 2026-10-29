const request = require('supertest');
const {
  API_PREFIX,
  app,
  prisma,
  redisConnection,
  registerUser,
  loginUser,
  createUrl,
  trackUrl,
  uniqueSlug,
  resetIntegrationRateLimit,
  cleanupFixtures,
  closeTestConnections,
} = require('./helpers');

describe('Redirect and Redis integration tests', () => {
  let token;

  beforeAll(async () => {
    await resetIntegrationRateLimit();
    const user = await registerUser();
    token = (await loginUser(user)).token;
  });

  afterAll(async () => {
    await cleanupFixtures();
    await resetIntegrationRateLimit();
    await closeTestConnections();
  });

  it('redirects an existing short code', async () => {
    const created = await createUrl(token, {
      customSlug: uniqueSlug('redirect'),
      originalUrl: 'https://example.com/redirect',
    });
    const response = await request(app).get(
      `${API_PREFIX}/urls/${created.body.data.shortCode}`,
    );

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('https://example.com/redirect');
  });

  it('warms Redis after a cache miss and serves a cache hit', async () => {
    const created = await createUrl(token, {
      customSlug: uniqueSlug('cache'),
      originalUrl: 'https://example.com/database',
    });
    const { id, shortCode } = created.body.data;
    const key = `urls:${shortCode}`;
    trackUrl(created.body.data);

    await redisConnection.del(key);
    const missResponse = await request(app).get(`${API_PREFIX}/urls/${shortCode}`);
    expect(missResponse.statusCode).toBe(302);
    expect(JSON.parse(await redisConnection.get(key))).toEqual({
      id,
      originalUrl: 'https://example.com/database',
    });

    await redisConnection.set(
      key,
      JSON.stringify({ id, originalUrl: 'https://example.com/from-cache' }),
    );
    const hitResponse = await request(app).get(`${API_PREFIX}/urls/${shortCode}`);
    expect(hitResponse.statusCode).toBe(302);
    expect(hitResponse.headers.location).toBe('https://example.com/from-cache');
  });

  it('stores a negative cache entry for a missing short code', async () => {
    const shortCode = uniqueSlug('missing');
    const key = `urls:${shortCode}`;
    trackUrl({ shortCode });
    const firstResponse = await request(app).get(`${API_PREFIX}/urls/${shortCode}`);
    const secondResponse = await request(app).get(`${API_PREFIX}/urls/${shortCode}`);

    expect(firstResponse.statusCode).toBe(404);
    expect(secondResponse.statusCode).toBe(404);
    await expect(redisConnection.get(key)).resolves.toBe('EMPTY');
  });

  it('keeps cache consistent when a URL is updated or deleted', async () => {
    const oldSlug = uniqueSlug('old');
    const newSlug = uniqueSlug('new');
    const created = await createUrl(token, {
      customSlug: oldSlug,
      originalUrl: 'https://example.com/old',
    });
    const { id } = created.body.data;
    const oldKey = `urls:${oldSlug}`;
    const newKey = `urls:${newSlug}`;
    trackUrl({ shortCode: newSlug });

    await request(app).get(`${API_PREFIX}/urls/${oldSlug}`);
    const updateResponse = await request(app)
      .patch(`${API_PREFIX}/urls/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customSlug: newSlug,
        originalUrl: 'https://example.com/new',
      });

    expect(updateResponse.statusCode).toBe(200);
    await expect(redisConnection.get(oldKey)).resolves.toBeNull();
    expect(JSON.parse(await redisConnection.get(newKey))).toEqual({
      id,
      originalUrl: 'https://example.com/new',
    });

    const deleteResponse = await request(app)
      .delete(`${API_PREFIX}/urls/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.statusCode).toBe(200);
    await expect(redisConnection.get(newKey)).resolves.toBeNull();
    await expect(prisma.url.findUnique({ where: { id } })).resolves.toBeNull();
  });
});
