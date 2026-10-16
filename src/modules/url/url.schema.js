const { z } = require('zod');

const createUrlSchema = z.object({
  originalUrl: z
    .string({ error: 'Original URL must be a string.' })
    .trim()
    .pipe(z.url({ error: 'Invalid URL format.' }))
    .refine(
      (url) => {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      },
      { error: 'URL must use HTTP or HTTPS.' },
    ),

  customSlug: z
    .string({ error: 'Custom URL must be a string.' })
    .trim()
    .min(3, { error: 'Custom URL must be at least 3 characters.' })
    .max(20, { error: 'Custom URL must not exceed 20 characters.' })
    .regex(/^[A-Za-z0-9-]+$/, {
      error: 'Custom URL may only contain letters, numbers, and hyphens.',
    })
    .optional(),
});

const getUserUrlsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const updateUrlSchema = z.object({
  originalUrl: z
    .string({ error: 'Original URL must be a string.' })
    .trim()
    .pipe(z.url({ error: 'Invalid URL format.' }))
    .refine(
      (url) => {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      },
      { error: 'URL must use HTTP or HTTPS.' },
    )
    .optional(),

  customSlug: z
    .string({ error: 'Custom URL must be a string.' })
    .trim()
    .min(3, { error: 'Custom URL must be at least 3 characters.' })
    .max(20, { error: 'Custom URL must not exceed 20 characters.' })
    .regex(/^[A-Za-z0-9-]+$/, {
      error: 'Custom URL may only contain letters, numbers, and hyphens.',
    })
    .optional(),
});

module.exports = { createUrlSchema, getUserUrlsQuerySchema, updateUrlSchema };
