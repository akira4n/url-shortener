const getClientIp = (req) => {
  return req.ip || req.socket?.remoteAddress || null;
};

module.exports = {
  getClientIp,
};
