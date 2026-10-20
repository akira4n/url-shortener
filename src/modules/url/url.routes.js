const express = require('express');
const router = express.Router();
const urlController = require('./url.controller');
const validate = require('../../middlewares/validate');
const urlSchema = require('./url.schema');
const authenticate = require('../../middlewares/authenticate');

router.get(
  '/',
  authenticate,
  validate(urlSchema.getUserUrlsQuerySchema, 'query'),
  urlController.getUserUrls,
);

router.post(
  '/',
  authenticate,
  validate(urlSchema.createUrlSchema),
  urlController.createShortUrl,
);

router.patch(
  '/:id',
  authenticate,
  validate(urlSchema.updateUrlSchema),
  urlController.updateUrl,
);

router.delete('/:id', authenticate, urlController.deleteUrl);

// public route
router.get('/:code', urlController.redirectToOriginalUrl);

module.exports = router;
