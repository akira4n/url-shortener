const request = require('supertest');
const {
  API_PREFIX,
  app,
  prisma,
  registerUser,
  loginUser,
  createUrl,
  uniqueSlug,
  resetIntegrationRateLimit,
  cleanupFixtures,
  closeTestConnections,
} = require('./helpers');

describe('URL management integration tests', () => {
  let owner;
  let ownerToken;
  let otherUser;
  let otherUserToken;

  beforeAll(async () => {
    await resetIntegrationRateLimit();
    owner = await registerUser();
    otherUser = await registerUser();
    ownerToken = (await loginUser(owner)).token;
    otherUserToken = (await loginUser(otherUser)).token;
  });

  afterAll(async () => {
    await cleanupFixtures();
    await resetIntegrationRateLimit();
    await closeTestConnections();
  });

  it('creates a short URL and persists the record', async () => {
    const response = await createUrl(ownerToken, {
      customSlug: uniqueSlug('created'),
      originalUrl: 'https://example.com/created',
    });

    expect(response.statusCode).toBe(201);
    const persisted = await prisma.url.findUnique({
      where: { id: response.body.data.id },
    });
    expect(persisted).toEqual(
      expect.objectContaining({
        originalUrl: 'https://example.com/created',
        userId: owner.response.body.data.user.id,
      }),
    );
  });

  it('rejects a duplicate custom slug', async () => {
    const customSlug = uniqueSlug('duplicate');
    const first = await createUrl(ownerToken, { customSlug });
    const second = await createUrl(otherUserToken, { customSlug });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(409);
  });

  it('does not expose another user URL in the owner URL list', async () => {
    const created = await createUrl(ownerToken);
    const response = await request(app)
      .get(`${API_PREFIX}/urls`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.data.id }),
      ]),
    );
  });

  it('rejects another user from updating or deleting a URL', async () => {
    const created = await createUrl(ownerToken);
    const { id } = created.body.data;
    const updateResponse = await request(app)
      .patch(`${API_PREFIX}/urls/${id}`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ originalUrl: 'https://example.com/forbidden' });
    const deleteResponse = await request(app)
      .delete(`${API_PREFIX}/urls/${id}`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(updateResponse.statusCode).toBe(403);
    expect(deleteResponse.statusCode).toBe(403);
  });

  it('returns a validation error for invalid URL input', async () => {
    const response = await createUrl(ownerToken, {
      originalUrl: 'ftp://example.com/file',
    });

    expect(response.statusCode).toBe(400);
  });
});
