const bcrypt = require('bcrypt');
const request = require('supertest');
const {
  API_PREFIX,
  app,
  prisma,
  registerUser,
  loginUser,
  resetIntegrationRateLimit,
  cleanupFixtures,
  closeTestConnections,
} = require('./helpers');

describe('Authentication integration tests', () => {
  beforeAll(async () => {
    await resetIntegrationRateLimit();
  });

  afterAll(async () => {
    await cleanupFixtures();
    await resetIntegrationRateLimit();
    await closeTestConnections();
  });

  it('registers a user and persists it in PostgreSQL with a hashed password', async () => {
    const password = 'password123';
    const { email, response } = await registerUser({ password });

    expect(response.statusCode).toBe(201);
    expect(response.body.data.user.email).toBe(email);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user.password).not.toBe(password);
    await expect(bcrypt.compare(password, user.password)).resolves.toBe(true);
  });

  it('rejects a duplicate email', async () => {
    const first = await registerUser();
    const duplicate = await registerUser({
      email: first.email,
    });

    expect(first.response.statusCode).toBe(201);
    expect(duplicate.response.statusCode).toBe(409);
  });

  it('returns a JWT for valid login credentials', async () => {
    const user = await registerUser();
    const { response, token } = await loginUser(user);

    expect(response.statusCode).toBe(200);
    expect(token).toEqual(expect.any(String));
    expect(token.split('.')).toHaveLength(3);
  });

  it('rejects access to a protected endpoint without a token', async () => {
    const response = await request(app).get(`${API_PREFIX}/urls`);

    expect(response.statusCode).toBe(401);
  });
});
