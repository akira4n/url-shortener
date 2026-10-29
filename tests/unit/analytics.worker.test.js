const mockWorker = {
  on: jest.fn(),
};

jest.mock('bullmq', () => ({
  Worker: jest.fn(() => mockWorker),
}));

jest.mock('../../src/infrastructure/redis', () => ({
  redisOptions: {
    host: 'localhost',
    port: 6379,
  },
}));

jest.mock('../../src/infrastructure/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('../../src/modules/analytics/analytics.repository');
jest.mock('../../src/utils/ua-parser');

const { Worker } = require('bullmq');
const { logger } = require('../../src/infrastructure/logger');
const analyticsRepository = require('../../src/modules/analytics/analytics.repository');
const { parseUserAgent } = require('../../src/utils/ua-parser');

require('../../src/modules/analytics/analytics.worker');

const workerArguments = Worker.mock.calls[0];
const processor = Worker.mock.calls[0][1];
const failedHandler = mockWorker.on.mock.calls.find(
  ([event]) => event === 'failed',
)[1];
const errorHandler = mockWorker.on.mock.calls.find(
  ([event]) => event === 'error',
)[1];

describe('Analytics Worker Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create the analytics worker with the expected queue and concurrency', () => {
    expect(workerArguments).toEqual([
      'analytics-queue',
      expect.any(Function),
      expect.objectContaining({
        connection: {
          host: 'localhost',
          port: 6379,
        },
        concurrency: 5,
      }),
    ]);
  });

  it('should parse the user agent and create a click log', async () => {
    const clickedAt = '2026-10-27T10:00:00.000Z';
    const parsedUserAgent = {
      browser: 'Chrome',
      os: 'Windows',
      deviceType: 'desktop',
    };
    parseUserAgent.mockReturnValue(parsedUserAgent);
    analyticsRepository.createClickLog.mockResolvedValue({ id: 1n });

    await processor({
      data: {
        urlId: 'url-uuid-123',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        referer: 'https://example.com',
        clickedAt,
      },
    });

    expect(parseUserAgent).toHaveBeenCalledWith('Mozilla/5.0');
    expect(analyticsRepository.createClickLog).toHaveBeenCalledWith({
      urlId: 'url-uuid-123',
      ipAddress: '127.0.0.1',
      referer: 'https://example.com',
      clickedAt: new Date(clickedAt),
      ...parsedUserAgent,
    });
  });

  it('should use the current date when clickedAt is missing', async () => {
    parseUserAgent.mockReturnValue({
      browser: null,
      os: null,
      deviceType: 'unknown',
    });
    analyticsRepository.createClickLog.mockResolvedValue({});

    await processor({
      data: {
        urlId: 'url-uuid-123',
        ipAddress: '127.0.0.1',
        userAgent: null,
        referer: null,
      },
    });

    expect(parseUserAgent).toHaveBeenCalledWith(null);
    expect(
      analyticsRepository.createClickLog.mock.calls[0][0].clickedAt,
    ).toBeInstanceOf(Date);
  });

  it('should propagate repository errors', async () => {
    const error = new Error('Database unavailable');
    parseUserAgent.mockReturnValue({});
    analyticsRepository.createClickLog.mockRejectedValue(error);

    await expect(
      processor({
        data: {
          urlId: 'url-uuid-123',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
        },
      }),
    ).rejects.toBe(error);
  });

  it('should log failed jobs', () => {
    const error = new Error('Job failed');

    failedHandler({ id: 'job-123' }, error);

    expect(logger.error).toHaveBeenCalledWith(
      { err: error, jobId: 'job-123' },
      'Click analytics job failed',
    );
  });

  it('should log worker connection errors', () => {
    const error = new Error('Redis unavailable');

    errorHandler(error);

    expect(logger.error).toHaveBeenCalledWith(
      { err: error },
      'Click analytics worker connection error',
    );
  });
});
