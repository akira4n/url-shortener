const { z } = require('zod');

const MAX_ANALYTICS_RANGE_DAYS = 365;

const getAnalyticsSchema = z
  .object({
    startDate: z.iso
      .date({ error: 'Start date should be ISO date format.' })
      .optional(),

    endDate: z.iso
      .date({ error: 'End date should be ISO date format.' })
      .optional(),
  })
  .refine(
    ({ startDate, endDate }) => !startDate || !endDate || startDate <= endDate,
    {
      message: 'Start date must be before or equal to end date.',
      path: ['endDate'],
    },
  )
  .refine(
    ({ startDate, endDate }) => {
      if (!startDate || !endDate) {
        return true;
      }

      const rangeInDays =
        (Date.parse(endDate) - Date.parse(startDate)) / (1000 * 60 * 60 * 24);

      return rangeInDays <= MAX_ANALYTICS_RANGE_DAYS;
    },
    {
      message: `Date range must not exceed ${MAX_ANALYTICS_RANGE_DAYS} days.`,
      path: ['endDate'],
    },
  );

module.exports = {
  getAnalyticsSchema,
};
