jest.mock('../../src/modules/analytics/analytics.repository');
jest.mock('../../src/modules/url/url.repository');

const analyticsService = require('../../src/modules/analytics/analytics.service');
const analyticsRepository = require('../../src/modules/analytics/analytics.repository');
const urlRepository = require('../../src/modules/url/url.repository');

describe('Analytics Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const url = {
    id: 'url-uuid-123',
    userId: 'user-uuid-123',
  };

  const summary = {
    totalClicks: 10,
    byDevice: [],
    byBrowser: [],
    byOs: [],
  };

  it('should throw 404 if the URL does not exist', async () => {
    urlRepository.findById.mockResolvedValue(null);

    await expect(
      analyticsService.getAnalyticsSummary({
        urlId: url.id,
        userId: url.userId,
      }),
    ).rejects.toMatchObject({
      message: 'URL not found.',
      status: 404,
    });

    expect(analyticsRepository.getSummaryByUrlId).not.toHaveBeenCalled();
  });

  it('should throw 403 if the user does not own the URL', async () => {
    urlRepository.findById.mockResolvedValue(url);

    await expect(
      analyticsService.getAnalyticsSummary({
        urlId: url.id,
        userId: 'different-user-uuid',
      }),
    ).rejects.toMatchObject({
      message: 'Forbidden.',
      status: 403,
    });

    expect(analyticsRepository.getSummaryByUrlId).not.toHaveBeenCalled();
  });

  it('should return the analytics summary without date filters', async () => {
    urlRepository.findById.mockResolvedValue(url);
    analyticsRepository.getSummaryByUrlId.mockResolvedValue(summary);

    const result = await analyticsService.getAnalyticsSummary({
      urlId: url.id,
      userId: url.userId,
    });

    expect(urlRepository.findById).toHaveBeenCalledWith(url.id);
    expect(analyticsRepository.getSummaryByUrlId).toHaveBeenCalledWith({
      urlId: url.id,
      startDate: undefined,
      endDate: undefined,
    });
    expect(result).toBe(summary);
  });

  it('should pass date filters to the analytics repository', async () => {
    urlRepository.findById.mockResolvedValue(url);
    analyticsRepository.getSummaryByUrlId.mockResolvedValue(summary);

    const filters = {
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    };

    await analyticsService.getAnalyticsSummary({
      urlId: url.id,
      userId: url.userId,
      ...filters,
    });

    expect(analyticsRepository.getSummaryByUrlId).toHaveBeenCalledWith({
      urlId: url.id,
      ...filters,
    });
  });
});
