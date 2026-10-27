const { ipKeyGenerator, rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redisConnection } = require('../infrastructure/redis');

const createStore = (prefix) =>
  new RedisStore({
    sendCommand: (...args) => redisConnection.call(...args),
    prefix: `ratelimit:${prefix}:`,
  });

const getIpKey = (req) => ipKeyGenerator(req.ip);

const authLoginLimiter = rateLimit({
  windowMs: 3 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth-login'),
  keyGenerator: (req) => {
    const ip = getIpKey(req);
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.toLowerCase().trim()
        : '';
    return email ? `${ip}:${email}` : ip;
  },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message:
        'Too many login attempts for this account. Please try again after 3 minutes.',
    });
  },
});

const authRegisterLimiter = rateLimit({
  windowMs: 3 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth-register'),
  keyGenerator: getIpKey,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message:
        'Too many account registration requests from this IP. Please try again after 3 minutes.',
    });
  },
});

const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('public-api'),
  keyGenerator: getIpKey,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message:
        'Rate limit exceeded for public requests. Max 60 requests per minute.',
    });
  },
});

const urlCrudLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('url-crud'),
  keyGenerator: (req) => {
    return req.user?.id || getIpKey(req);
  },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many URL operations. Max 20 requests per minute allowed.',
    });
  },
});

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('analytics'),
  keyGenerator: (req) => {
    return req.user?.id || getIpKey(req);
  },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message:
        'Too many analytics requests. Max 15 requests per minute allowed.',
    });
  },
});

module.exports = {
  authLoginLimiter,
  authRegisterLimiter,
  publicApiLimiter,
  urlCrudLimiter,
  analyticsLimiter,
};
