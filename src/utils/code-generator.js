const { customAlphabet } = require('nanoid');

const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const generateShortCode = customAlphabet(alphabet, 7);

module.exports = {
  generateShortCode,
};
