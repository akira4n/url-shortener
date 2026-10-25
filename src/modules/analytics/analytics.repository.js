const prisma = require('../../infrastructure/database');

const createClickLog = (data) => {
  return prisma.clickAnalytic.create({
    data,
  });
};

const getSummaryByUrlId = async ({ urlId, startDate, endDate }) => {
  const where = {
    urlId,
    ...(startDate || endDate
      ? {
          clickedAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        }
      : {}),
  };

  const [totalClicks, byDevice, byBrowser, byOs] = await Promise.all([
    prisma.clickAnalytic.count({ where }),

    prisma.clickAnalytic.groupBy({
      by: ['deviceType'],
      where,
      _count: { _all: true },
    }),

    prisma.clickAnalytic.groupBy({
      by: ['browser'],
      where,
      _count: { _all: true },
    }),

    prisma.clickAnalytic.groupBy({
      by: ['os'],
      where,
      _count: { _all: true },
    }),
  ]);

  return {
    totalClicks,
    byDevice,
    byBrowser,
    byOs,
  };
};

module.exports = { createClickLog, getSummaryByUrlId };
