const express = require('express');
const cors = require('cors');
const { httpLogger } = require('./infrastructure/logger');
const errorHandler = require('./middlewares/error-handler');

// import routes
const authRoutes = require('./modules/auth/auth.routes');

const app = express();

app.use(cors());

app.use(httpLogger);
app.use(express.json());

// check api health
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Service is healthy',
  });
});

// routes
app.use('/api/v1/auth', authRoutes);

// 404 route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// global error handler
app.use(errorHandler);

module.exports = app;
