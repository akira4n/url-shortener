const { z } = require('zod');

const registerSchema = z.object({
  name: z
    .string({ error: 'Name is required.' })
    .trim()
    .min(2, { error: 'Name must be at least 2 characters.' })
    .max(100, { error: 'Name must not exceed 100 characters.' }),

  email: z
    .email({ error: 'Email is required and must be a valid email address.' })
    .trim()
    .toLowerCase(),

  password: z
    .string({ error: 'Password is required.' })
    .min(8, { error: 'Password must be at least 8 characters.' })
    .max(72, { error: 'Password must not exceed 72 characters.' }),
});

const loginSchema = z.object({
  email: z
    .email({ error: 'Email is required and must be a valid email address.' })
    .trim()
    .toLowerCase(),

  password: z
    .string({ error: 'Password is required.' })
    .min(1, { error: 'Password is required.' }),
});

module.exports = {
  registerSchema,
  loginSchema,
};
