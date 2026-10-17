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
      logger.warn(
        { err: redisErr, shortCode },
        'Failed to warm Redis cache during URL creation',
      );
    }

    return urlRecord;
  }
};

const getOriginalUrl = async (shortCode) => {
  let cachedValue = null;
  const cacheKey = `urls:${shortCode}`;

  try {
    cachedValue = await redisConnection.get(cacheKey);
  } catch (redisErr) {
    logger.warn(
      { err: redisErr, shortCode },
      'Redis unavailable, falling back to database',
    );
  }

  // negative cache
  if (cachedValue === 'EMPTY') {
    const error = new Error('Short URL not found.');
    error.status = 404;
    throw error;
  }

  // cache hit
  if (cachedValue !== null) {
    return JSON.parse(cachedValue);
  }

  // cache miss or Redis failure
  const url = await urlRepository.findByShortCode(shortCode);

  // URL not found
  if (!url) {
    try {
      await redisConnection.set(cacheKey, 'EMPTY', 'EX', 60);
    } catch (redisErr) {
      logger.warn(
        { err: redisErr, shortCode },
        'Failed to cache missing short URL',
      );
    }

    const error = new Error('Short URL not found.');
    error.status = 404;
    throw error;
  }

  // cache warming
  try {
    const cacheValue = JSON.stringify({
      id: url.id,
      originalUrl: url.originalUrl,
    });

    await redisConnection.set(cacheKey, cacheValue, 'EX', 86400);
  } catch (redisErr) {
    logger.warn({ err: redisErr, shortCode }, 'Failed to warm URL cache');
  }

  return {
    id: url.id,
    originalUrl: url.id,
  };
};

const getUserUrls = async ({ userId, page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;

  const [urls, total] = await urlRepository.findAndCountByUserId({
    userId,
    skip,
    limit,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    urls,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

const updateUrl = async ({ id, userId, originalUrl, customSlug }) => {
  const url = await urlRepository.findById(id);

  if (!url) {
    const error = new Error('URL not found.');
    error.status = 404;
    throw error;
  }

  if (url.userId !== userId) {
    const error = new Error('Forbidden.');
    error.status = 403;
    throw error;
  }

  const data = {};
  if (originalUrl) data.originalUrl = originalUrl;
  if (customSlug) data.shortCode = customSlug;

  let updatedUrl;

  try {
    updatedUrl = await urlRepository.update(id, data);
  } catch (err) {
    if (err.code === 'P2002') {
      const error = new Error('Custom slug is already taken.');
      error.status = 409;
      throw error;
    }

    throw err;
  }

  // cache Invalidation & Cache Warming
  try {
    await redisConnection.del(`urls:${url.shortCode}`);

    const newCacheKey = `urls:${updatedUrl.shortCode}`;
    const newCacheValue = JSON.stringify({
      id: updatedUrl.id,
      originalUrl: updatedUrl.originalUrl,
    });

    await redisConnection.set(newCacheKey, newCacheValue, 'EX', 86400);
  } catch (redisErr) {
    logger.warn(
      { err: redisErr, urlId: id },
      'Failed to update Redis cache after URL modification',
    );
  }

  return updatedUrl;
};

const deleteUrl = async ({ id, userId }) => {
  const url = await urlRepository.findById(id);

  if (!url) {
    const error = new Error('URL not found.');
    error.status = 404;
    throw error;
  }

  if (url.userId !== userId) {
    const error = new Error('Forbidden.');
    error.status = 403;
    throw error;
  }

  const deleted = await urlRepository.deleteById(id);

  try {
    await redisConnection.del(`urls:${url.shortCode}`);
  } catch (redisErr) {
    logger.warn({ err: redisErr, urlId: id }, 'Failed to delete Redis cache');
  }

  return deleted;
};

module.exports = {
  createShortUrl,
  getOriginalUrl,
  getUserUrls,
  updateUrl,
  deleteUrl,
};
