const analyticsService = require('./analytics.service');

const getAnalyticsSummary = async (req, res, next) => {
  try {
    const result = await analyticsService.getAnalyticsSummary({
      ...req.query,
      urlId: req.params.urlId,
      userId: req.user.id,
    });

    res.status(200).json({
      success: true,
      message: 'Analytics summary retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalyticsSummary,
};
