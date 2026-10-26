const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const validate = require('../../middlewares/validate');
const analyticsSchema = require('./analytics.schema');
const authenticate = require('../../middlewares/authenticate');

router.get(
  '/:urlId',
  authenticate,
  validate(analyticsSchema.getAnalyticsSchema, 'query'),
  analyticsController.getAnalyticsSummary,
);

module.exports = router;
