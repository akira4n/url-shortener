const express = require('express');
const router = express.Router();
const urlController = require('./url.controller');
const validate = require('../../middlewares/validate');
const urlSchema = require('./url.schema');
const authenticate = require('../../middlewares/authenticate');

router.get('/:code', urlController.redirectToOriginalUrl);

router.post(
  '/',
  authenticate,
  validate(urlSchema.createUrlSchema),
  urlController.createShortUrl,
);

module.exports = router;
