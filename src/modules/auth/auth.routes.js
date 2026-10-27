const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const validate = require('../../middlewares/validate');
const authSchema = require('./auth.schema');
const {
  authLoginLimiter,
  authRegisterLimiter,
} = require('../../middlewares/rate-limiter');

router.post(
  '/register',
  authRegisterLimiter,
  validate(authSchema.registerSchema),
  authController.register,
);

router.post(
  '/login',
  authLoginLimiter,
  validate(authSchema.loginSchema),
  authController.login,
);

module.exports = router;
