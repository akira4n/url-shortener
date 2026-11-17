const jwt = require('jsonwebtoken');

const getSecret = () => process.env.JWT_SECRET;
const getExpiresIn = () => process.env.JWT_EXPIRES_IN || '3d';

const signToken = (payload) =>
  jwt.sign(payload, getSecret(), {
    expiresIn: getExpiresIn(),
  });

const verifyToken = (token) => jwt.verify(token, getSecret());

module.exports = {
  signToken,
  verifyToken,
};
