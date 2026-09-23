const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const validate = require('../../middlewares/validate');
const authSchema = require('./auth.schema');

router.post(
  '/register',
  validate(authSchema.registerSchema),
  authController.register,
);

router.post('/login', validate(authSchema.loginSchema), authController.login);

module.exports = router;
