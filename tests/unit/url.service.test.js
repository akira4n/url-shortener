jest.mock('../../src/modules/url/url.repository');
jest.mock('../../src/utils/code-generator');
jest.mock('../../src/infrastructure/redis', () => ({
  redisConnection: {
    set: jest.fn(),
  },
}));
jest.mock('../../src/infrastructure/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

const urlService = require('../../src/modules/url/url.service');
const urlRepository = require('../../src/modules/url/url.repository');
const { generateShortCode } = require('../../src/utils/code-generator');
const { redisConnection } = require('../../src/infrastructure/redis');
const { logger } = require('../../src/infrastructure/logger');

describe('URL Service - createShortUrl() Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultInput = {
    userId: 'user-uuid-123',
    originalUrl: 'https://google.com',
  };

  const mockCreatedRecord = {
    id: 'url-uuid-999',
    userId: defaultInput.userId,
    originalUrl: defaultInput.originalUrl,
    shortCode: 'abc1234',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('Auto-Generated Short Code Path', () => {
    it('should successfully create short URL and warm Redis cache on first attempt', async () => {
      generateShortCode.mockReturnValue('abc1234');
      urlRepository.create.mockResolvedValue(mockCreatedRecord);
      redisConnection.set.mockResolvedValue('OK');

      const result = await urlService.createShortUrl(defaultInput);

      expect(generateShortCode).toHaveBeenCalledTimes(1);
      expect(urlRepository.create).toHaveBeenCalledWith({
        userId: defaultInput.userId,
        originalUrl: defaultInput.originalUrl,
        shortCode: 'abc1234',
      });
      expect(redisConnection.set).toHaveBeenCalledWith(
        'urls:abc1234',
        JSON.stringify({
          id: mockCreatedRecord.id,
          originalUrl: mockCreatedRecord.originalUrl,
        }),
        'EX',
        86400,
      );
      expect(result).toEqual(mockCreatedRecord);
    });

    it('should retry generation if P2002 error occurs and succeed on second attempt', async () => {
      generateShortCode
        .mockReturnValueOnce('collision1')
        .mockReturnValueOnce('unique2');

      const p2002Error = new Error('Unique constraint failed');
      p2002Error.code = 'P2002';

      urlRepository.create
        .mockRejectedValueOnce(p2002Error)
        .mockResolvedValueOnce({ ...mockCreatedRecord, shortCode: 'unique2' });

      redisConnection.set.mockResolvedValue('OK');

      const result = await urlService.createShortUrl(defaultInput);

      expect(generateShortCode).toHaveBeenCalledTimes(2);
      expect(urlRepository.create).toHaveBeenCalledTimes(2);
      expect(result.shortCode).toBe('unique2');
    });

    it('should throw 503 error if all 3 attempts fail due to P2002 collisions', async () => {
      generateShortCode.mockReturnValue('collided');

      const p2002Error = new Error('Unique constraint failed');
      p2002Error.code = 'P2002';

      urlRepository.create.mockRejectedValue(p2002Error);

      await expect(
        urlService.createShortUrl(defaultInput),
      ).rejects.toMatchObject({
        status: 503,
        message: 'Unable to generate a unique short URL. Please try again.',
      });

      expect(generateShortCode).toHaveBeenCalledTimes(3);
      expect(urlRepository.create).toHaveBeenCalledTimes(3);
      expect(redisConnection.set).not.toHaveBeenCalled();
    });
  });

  describe('Custom Slug Path', () => {
    const customInput = {
      ...defaultInput,
      customSlug: 'my-custom-link',
    };

    it('should successfully create short URL using custom slug', async () => {
      const customRecord = {
        ...mockCreatedRecord,
        shortCode: 'my-custom-link',
      };
      urlRepository.create.mockResolvedValue(customRecord);
      redisConnection.set.mockResolvedValue('OK');

      const result = await urlService.createShortUrl(customInput);

      expect(generateShortCode).not.toHaveBeenCalled();
      expect(urlRepository.create).toHaveBeenCalledWith({
        userId: customInput.userId,
        originalUrl: customInput.originalUrl,
        shortCode: 'my-custom-link',
      });
      expect(result).toEqual(customRecord);
    });

    it('should throw 409 error if custom slug is already taken (P2002) without retrying', async () => {
      const p2002Error = new Error('Unique constraint failed');
      p2002Error.code = 'P2002';

      urlRepository.create.mockRejectedValue(p2002Error);

      await expect(
        urlService.createShortUrl(customInput),
      ).rejects.toMatchObject({
        status: 409,
        message: 'Custom slug is already taken.',
      });

      expect(urlRepository.create).toHaveBeenCalledTimes(1);
      expect(generateShortCode).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases & Resiliency', () => {
    it('should return created record even if Redis cache warming fails (non-blocking cache)', async () => {
      generateShortCode.mockReturnValue('abc1234');
      urlRepository.create.mockResolvedValue(mockCreatedRecord);

      // Simulasikan Redis Down / Error
      const redisError = new Error('Redis connection refused');
      redisConnection.set.mockRejectedValue(redisError);

      const result = await urlService.createShortUrl(defaultInput);

      expect(logger.error).toHaveBeenCalledWith(
        { err: redisError },
        'Failed to warm Redis cache during URL creation',
      );
      expect(result).toEqual(mockCreatedRecord); // Tetap sukses mengembalikan data
    });

    it('should rethrow unexpected database errors (non-P2002)', async () => {
      generateShortCode.mockReturnValue('abc1234');

      const dbError = new Error('Database connection lost');
      urlRepository.create.mockRejectedValue(dbError);

      await expect(urlService.createShortUrl(defaultInput)).rejects.toThrow(
        'Database connection lost',
      );
      expect(urlRepository.create).toHaveBeenCalledTimes(1);
    });
  });
});
