jest.mock('../../src/modules/auth/auth.repository');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const authService = require('../../src/modules/auth/auth.service');
const authRepository = require('../../src/modules/auth/auth.repository');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('Auth Service Unit Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('register()', () => {
    const registerInput = {
      name: 'user',
      email: 'user@example.com',
      password: 'password123',
    };

    it('should register a new user successfully and return user data with token', async () => {
      const mockCreatedUser = {
        id: 'user-uuid-123',
        name: registerInput.name,
        email: registerInput.email,
        password: 'hashed_password_123',
      };

      authRepository.findByEmail.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed_password_123');
      authRepository.create.mockResolvedValue(mockCreatedUser);
      jwt.sign.mockReturnValue('mocked_jwt_token');

      const result = await authService.register(registerInput);

      expect(authRepository.findByEmail).toHaveBeenCalledWith(
        registerInput.email,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(registerInput.password, 12);
      expect(authRepository.create).toHaveBeenCalledWith({
        name: registerInput.name,
        email: registerInput.email,
        password: 'hashed_password_123',
      });
      expect(jwt.sign).toHaveBeenCalled();
      expect(result).toEqual({
        user: {
          id: 'user-uuid-123',
          name: 'user',
          email: 'user@example.com',
        },
        token: 'mocked_jwt_token',
      });
    });

    it('should throw 409 error if email is already registered', async () => {
      authRepository.findByEmail.mockResolvedValue({
        id: 'existing-uuid',
        email: registerInput.email,
      });

      await expect(authService.register(registerInput)).rejects.toMatchObject({
        status: 409,
        message: 'Email is already registered.',
      });

      expect(authRepository.create).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('login()', () => {
    const loginInput = {
      email: 'user@example.com',
      password: 'password123',
    };

    const mockUserFromDb = {
      id: 'user-uuid-123',
      name: 'user',
      email: 'user@example.com',
      password: 'hashed_password_123',
    };

    it('should authenticate user successfully and return user data with token', async () => {
      authRepository.findByEmail.mockResolvedValue(mockUserFromDb);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mocked_jwt_token');

      const result = await authService.login(loginInput);

      expect(authRepository.findByEmail).toHaveBeenCalledWith(loginInput.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginInput.password,
        mockUserFromDb.password,
      );
      expect(result).toEqual({
        user: {
          id: 'user-uuid-123',
          name: 'user',
          email: 'user@example.com',
        },
        token: 'mocked_jwt_token',
      });
    });

    it('should throw 401 error if user is not found', async () => {
      authRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginInput)).rejects.toMatchObject({
        status: 401,
        message: 'Invalid email or password.',
      });

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw 401 error if password does not match', async () => {
      authRepository.findByEmail.mockResolvedValue(mockUserFromDb);
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.login(loginInput)).rejects.toMatchObject({
        status: 401,
        message: 'Invalid email or password.',
      });

      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });
});
