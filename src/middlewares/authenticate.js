const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Authorization token is required.');
      error.status = 401;
      throw error;
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (!token) {
      const error = new Error('Authorization token is required.');
      error.status = 401;
      throw error;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      error.status = 401;
      error.message = 'Session expired.';
    } else if (error.name === 'JsonWebTokenError') {
      error.status = 401;
      error.message = 'Invalid token.';
    }

    next(error);
  }
};

module.exports = authenticate;
