const express = require('express');
const router = express.Router();
const urlController = require('./url.controller');
const validate = require('../../middlewares/validate');
const urlSchema = require('./url.schema');
const authenticate = require('../../middlewares/authenticate');
const {
  urlCrudLimiter,
  publicApiLimiter,
} = require('../../middlewares/rate-limiter');

router.get(
  '/',
  authenticate,
  urlCrudLimiter,
  validate(urlSchema.getUserUrlsQuerySchema, 'query'),
  urlController.getUserUrls,
);

router.post(
  '/',
  authenticate,
  urlCrudLimiter,
  validate(urlSchema.createUrlSchema),
  urlController.createShortUrl,
);

router.patch(
  '/:id',
  authenticate,
  urlCrudLimiter,
  validate(urlSchema.updateUrlSchema),
  urlController.updateUrl,
);

router.delete('/:id', authenticate, urlCrudLimiter, urlController.deleteUrl);

// public route
router.get('/:code', publicApiLimiter, urlController.redirectToOriginalUrl);

module.exports = router;
