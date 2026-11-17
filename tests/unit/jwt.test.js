jest.mock('jsonwebtoken');

const jwt = require('jsonwebtoken');
const { signToken, verifyToken } = require('../../src/utils/jwt');

describe('JWT utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '2h',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('signs a token using the configured secret and expiry', () => {
    jwt.sign.mockReturnValue('signed-token');
    const payload = { id: 'user-1', email: 'user@example.com' };

    expect(signToken(payload)).toBe('signed-token');
    expect(jwt.sign).toHaveBeenCalledWith(payload, 'test-secret', {
      expiresIn: '2h',
    });
  });

  it('uses the default expiry when none is configured', () => {
    delete process.env.JWT_EXPIRES_IN;
    jwt.sign.mockReturnValue('signed-token');

    signToken({ id: 'user-1' });

    expect(jwt.sign).toHaveBeenCalledWith(
      { id: 'user-1' },
      'test-secret',
      { expiresIn: '3d' },
    );
  });

  it('verifies a token using the configured secret', () => {
    const decoded = { id: 'user-1' };
    jwt.verify.mockReturnValue(decoded);

    expect(verifyToken('signed-token')).toBe(decoded);
    expect(jwt.verify).toHaveBeenCalledWith('signed-token', 'test-secret');
  });
});
