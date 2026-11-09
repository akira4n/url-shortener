const { getAnalyticsSchema } = require('../../src/modules/analytics/analytics.schema');

describe('Analytics Schema Unit Tests', () => {
  it('accepts a date range of exactly 365 days', () => {
    const result = getAnalyticsSchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2027-01-01',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a date range longer than 365 days', () => {
    const result = getAnalyticsSchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2027-01-02',
    });

    expect(result.success).toBe(false);
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['endDate'],
          message: 'Date range must not exceed 365 days.',
        }),
      ]),
    );
  });
});
