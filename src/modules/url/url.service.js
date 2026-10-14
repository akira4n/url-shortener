const urlRepository = require('./url.repository');
const { generateShortCode } = require('../../utils/code-generator');
const { redisConnection } = require('../../infrastructure/redis');
const { logger } = require('../../infrastructure/logger');

const createShortUrl = async ({ userId, originalUrl, customSlug }) => {
  const isCustomSlug = Boolean(customSlug);
  const maxAttempts = isCustomSlug ? 1 : 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shortCode = isCustomSlug ? customSlug : generateShortCode();

    let urlRecord;
    try {
      urlRecord = await urlRepository.create({
        userId,
        originalUrl,
        shortCode,
      });
    } catch (err) {
      if (err.code === 'P2002') {
        if (isCustomSlug) {
          const error = new Error('Custom slug is already taken.');
          error.status = 409;
          throw error;
        }

        if (attempt < maxAttempts - 1) {
          continue;
        }

        const error = new Error(
          'Unable to generate a unique short URL. Please try again.',
        );
        error.status = 503;
        throw error;
      }

      throw err;
    }

    try {
      const cacheKey = `urls:${shortCode}`;
      const cacheValue = JSON.stringify({
        id: urlRecord.id,
        originalUrl: urlRecord.originalUrl,
      });

      await redisConnection.set(cacheKey, cacheValue, 'EX', 86400);
    } catch (redisErr) {
      logger.error(
        { err: redisErr },
        'Failed to warm Redis cache during URL creation',
      );
    }

    return urlRecord;
  }
};

module.exports = { createShortUrl };
