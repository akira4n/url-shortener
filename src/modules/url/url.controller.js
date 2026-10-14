const urlService = require('./url.service');

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

module.exports = { createShortUrl };
