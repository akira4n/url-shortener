const analyticsRepository = require('./analytics.repository');
const urlRepository = require('../url/url.repository');

const getAnalyticsSummary = async ({ urlId, startDate, endDate, userId }) => {
  const url = await urlRepository.findById(urlId);

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

  return analyticsRepository.getSummaryByUrlId({
    urlId,
    startDate,
    endDate,
  });
};

module.exports = {
  getAnalyticsSummary,
};
