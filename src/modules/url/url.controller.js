const urlService = require('./url.service');
const { analyticsQueue } = require('../../infrastructure/queue');
const { getClientIp } = require('../../utils/ip-resolver');
const { logger } = require('../../infrastructure/logger');

const createShortUrl = async (req, res, next) => {
  try {
    const result = await urlService.createShortUrl({
      userId: req.user.id,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      message: 'Short URL created successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const redirectToOriginalUrl = async (req, res, next) => {
  try {
    const shortCode = req.params.code;
    const result = await urlService.getOriginalUrl(shortCode);

    analyticsQueue
      .add('log-click', {
        urlId: result.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
        referer: req.headers['referer'] || req.headers['referrer'] || null,
        clickedAt: new Date(),
      })
      .catch((err) => {
        logger.error(
          { err, urlId: result.id },
          'Failed to publish click analytics job',
        );
      });

    return res.redirect(302, result.originalUrl);
  } catch (error) {
    next(error);
  }
};

const getUserUrls = async (req, res, next) => {
  try {
    const result = await urlService.getUserUrls({
      userId: req.user.id,
      ...req.query,
    });

    res.status(200).json({
      success: true,
      message: 'URL list retrieved successfully.',
      data: result.urls,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

const updateUrl = async (req, res, next) => {
  try {
    const result = await urlService.updateUrl({
      id: req.params.id,
      userId: req.user.id,
      ...req.body,
    });

    res.status(200).json({
      success: true,
      message: 'URL updated successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const deleteUrl = async (req, res, next) => {
  try {
    await urlService.deleteUrl({
      id: req.params.id,
      userId: req.user.id,
    });

    res.status(200).json({
      success: true,
      message: 'URL deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createShortUrl,
  redirectToOriginalUrl,
  getUserUrls,
  updateUrl,
  deleteUrl,
};
