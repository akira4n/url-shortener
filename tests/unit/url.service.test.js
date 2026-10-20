jest.mock('../../src/modules/url/url.repository');
jest.mock('../../src/utils/code-generator');
jest.mock('../../src/infrastructure/redis', () => ({
  redisConnection: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));
jest.mock('../../src/infrastructure/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const urlService = require('../../src/modules/url/url.service');
const urlRepository = require('../../src/modules/url/url.repository');
const { generateShortCode } = require('../../src/utils/code-generator');
const { redisConnection } = require('../../src/infrastructure/redis');
const { logger } = require('../../src/infrastructure/logger');

describe('URL Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisConnection.get.mockResolvedValue(null);
    redisConnection.set.mockResolvedValue('OK');
    redisConnection.del.mockResolvedValue(1);
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

      expect(logger.warn).toHaveBeenCalledWith(
        { err: redisError, shortCode: 'abc1234' },
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

  describe('getOriginalUrl()', () => {
    it('returns the URL from a positive cache hit', async () => {
      const cachedUrl = {
        id: mockCreatedRecord.id,
        originalUrl: mockCreatedRecord.originalUrl,
      };
      redisConnection.get.mockResolvedValue(JSON.stringify(cachedUrl));

      const result = await urlService.getOriginalUrl('abc1234');

      expect(result).toEqual(cachedUrl);
      expect(urlRepository.findByShortCode).not.toHaveBeenCalled();
    });

    it('returns 404 from a negative cache hit', async () => {
      redisConnection.get.mockResolvedValue('EMPTY');

      await expect(urlService.getOriginalUrl('missing')).rejects.toMatchObject({
        status: 404,
        message: 'Short URL not found.',
      });
      expect(urlRepository.findByShortCode).not.toHaveBeenCalled();
    });

    it('reads from the database and warms cache after a cache miss', async () => {
      urlRepository.findByShortCode.mockResolvedValue(mockCreatedRecord);

      const result = await urlService.getOriginalUrl('abc1234');

      expect(urlRepository.findByShortCode).toHaveBeenCalledWith('abc1234');
      expect(redisConnection.set).toHaveBeenCalledWith(
        'urls:abc1234',
        JSON.stringify({
          id: mockCreatedRecord.id,
          originalUrl: mockCreatedRecord.originalUrl,
        }),
        'EX',
        86400,
      );
      expect(result).toEqual({
        id: mockCreatedRecord.id,
        originalUrl: mockCreatedRecord.originalUrl,
      });
    });

    it('returns 404 and stores a negative cache after a database miss', async () => {
      urlRepository.findByShortCode.mockResolvedValue(null);

      await expect(urlService.getOriginalUrl('missing')).rejects.toMatchObject({
        status: 404,
      });
      expect(redisConnection.set).toHaveBeenCalledWith(
        'urls:missing',
        'EMPTY',
        'EX',
        60,
      );
    });

    it('falls back to the database when Redis read fails', async () => {
      const redisError = new Error('Redis unavailable');
      redisConnection.get.mockRejectedValue(redisError);
      urlRepository.findByShortCode.mockResolvedValue(mockCreatedRecord);

      const result = await urlService.getOriginalUrl('abc1234');

      expect(logger.warn).toHaveBeenCalledWith(
        { err: redisError, shortCode: 'abc1234' },
        'Redis unavailable, falling back to database',
      );
      expect(result.originalUrl).toBe(mockCreatedRecord.originalUrl);
    });
  });

  describe('getUserUrls()', () => {
    it('returns URLs with pagination metadata', async () => {
      urlRepository.findAndCountByUserId.mockResolvedValue([
        [mockCreatedRecord],
        21,
      ]);

      const result = await urlService.getUserUrls({
        userId: defaultInput.userId,
        page: 2,
        limit: 10,
      });

      expect(urlRepository.findAndCountByUserId).toHaveBeenCalledWith({
        userId: defaultInput.userId,
        skip: 10,
        limit: 10,
      });
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });
      expect(result.urls).toEqual([mockCreatedRecord]);
    });
  });

  describe('updateUrl()', () => {
    it('updates an owned URL and refreshes its cache', async () => {
      const updatedUrl = {
        ...mockCreatedRecord,
        originalUrl: 'https://example.com',
        shortCode: 'new-code',
      };
      urlRepository.findById.mockResolvedValue(mockCreatedRecord);
      urlRepository.update.mockResolvedValue(updatedUrl);

      const result = await urlService.updateUrl({
        id: mockCreatedRecord.id,
        userId: mockCreatedRecord.userId,
        originalUrl: updatedUrl.originalUrl,
        customSlug: updatedUrl.shortCode,
      });

      expect(urlRepository.update).toHaveBeenCalledWith(updatedUrl.id, {
        originalUrl: updatedUrl.originalUrl,
        shortCode: updatedUrl.shortCode,
      });
      expect(redisConnection.del).toHaveBeenCalledWith('urls:abc1234');
      expect(redisConnection.set).toHaveBeenCalledWith(
        'urls:new-code',
        JSON.stringify({
          id: updatedUrl.id,
          originalUrl: updatedUrl.originalUrl,
        }),
        'EX',
        86400,
      );
      expect(result).toEqual(updatedUrl);
    });

    it('returns 404 when updating a missing URL', async () => {
      urlRepository.findById.mockResolvedValue(null);

      await expect(
        urlService.updateUrl({ id: 'missing', userId: defaultInput.userId }),
      ).rejects.toMatchObject({ status: 404 });
      expect(urlRepository.update).not.toHaveBeenCalled();
    });

    it('returns 403 when updating another user URL', async () => {
      urlRepository.findById.mockResolvedValue({
        ...mockCreatedRecord,
        userId: 'another-user',
      });

      await expect(
        urlService.updateUrl({
          id: mockCreatedRecord.id,
          userId: defaultInput.userId,
        }),
      ).rejects.toMatchObject({ status: 403, message: 'Forbidden.' });
      expect(urlRepository.update).not.toHaveBeenCalled();
    });

    it('returns 409 when the new custom slug is taken', async () => {
      urlRepository.findById.mockResolvedValue(mockCreatedRecord);
      const collision = new Error('Unique constraint failed');
      collision.code = 'P2002';
      urlRepository.update.mockRejectedValue(collision);

      await expect(
        urlService.updateUrl({
          id: mockCreatedRecord.id,
          userId: mockCreatedRecord.userId,
          customSlug: 'taken-code',
        }),
      ).rejects.toMatchObject({
        status: 409,
        message: 'Custom slug is already taken.',
      });
    });
  });

  describe('deleteUrl()', () => {
    it('deletes an owned URL and invalidates its cache', async () => {
      urlRepository.findById.mockResolvedValue(mockCreatedRecord);
      urlRepository.deleteById.mockResolvedValue(mockCreatedRecord);

      const result = await urlService.deleteUrl({
        id: mockCreatedRecord.id,
        userId: mockCreatedRecord.userId,
      });

      expect(urlRepository.deleteById).toHaveBeenCalledWith(
        mockCreatedRecord.id,
      );
      expect(redisConnection.del).toHaveBeenCalledWith('urls:abc1234');
      expect(result).toEqual(mockCreatedRecord);
    });

    it('returns 404 when deleting a missing URL', async () => {
      urlRepository.findById.mockResolvedValue(null);

      await expect(
        urlService.deleteUrl({ id: 'missing', userId: defaultInput.userId }),
      ).rejects.toMatchObject({ status: 404 });
      expect(urlRepository.deleteById).not.toHaveBeenCalled();
    });

    it('returns 403 when deleting another user URL', async () => {
      urlRepository.findById.mockResolvedValue({
        ...mockCreatedRecord,
        userId: 'another-user',
      });

      await expect(
        urlService.deleteUrl({
          id: mockCreatedRecord.id,
          userId: defaultInput.userId,
        }),
      ).rejects.toMatchObject({ status: 403, message: 'Forbidden.' });
      expect(urlRepository.deleteById).not.toHaveBeenCalled();
    });

    it('still returns the deleted URL when Redis invalidation fails', async () => {
      urlRepository.findById.mockResolvedValue(mockCreatedRecord);
      urlRepository.deleteById.mockResolvedValue(mockCreatedRecord);
      const redisError = new Error('Redis unavailable');
      redisConnection.del.mockRejectedValue(redisError);

      const result = await urlService.deleteUrl({
        id: mockCreatedRecord.id,
        userId: mockCreatedRecord.userId,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        { err: redisError, urlId: mockCreatedRecord.id },
        'Failed to delete Redis cache',
      );
      expect(result).toEqual(mockCreatedRecord);
    });
  });
});
