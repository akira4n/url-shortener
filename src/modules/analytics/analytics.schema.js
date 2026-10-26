const { z } = require('zod');

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
  );

module.exports = {
  getAnalyticsSchema,
};
