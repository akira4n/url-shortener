const { UAParser } = require('ua-parser-js');

const parseUserAgent = (userAgentString) => {
  if (!userAgentString) {
    return {
      browser: null,
      os: null,
      deviceType: null,
    };
  }

  const parser = new UAParser(userAgentString);
  const result = parser.getResult();

  const browser = result.browser.name
    ? `${result.browser.name}${result.browser.version ? ' ' + result.browser.version.split('.')[0] : ''}`
    : null;

  const os = result.os.name
    ? `${result.os.name}${result.os.version ? ' ' + result.os.version : ''}`
    : null;

  const deviceType = result.device.type || 'desktop';

  return {
    browser,
    os,
    deviceType,
  };
};

module.exports = {
  parseUserAgent,
};
