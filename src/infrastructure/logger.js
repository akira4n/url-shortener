const pino = require('pino');
const pinoHttp = require('pino-http');
const { randomUUID } = require('node:crypto');

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = pino({
  level: isDevelopment ? 'debug' : 'info',

  redact: {
    paths: [
      'req.headers.authorization',
      'body.password',
      'body.token',
      'password',
      'token',
    ],
    censor: '[REDACTED]',
  },
});

const httpLogger = pinoHttp({
  logger,

  genReqId: (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-ID', requestId);
    return requestId;
  },

  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) {
      return 'error';
    }

    if (res.statusCode >= 400) {
      return 'warn';
    }

    return 'info';
  },
});

module.exports = {
  logger,
  httpLogger,
};
