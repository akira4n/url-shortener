const prisma = require('../../infrastructure/database');

const create = (data) => {
  return prisma.url.create({
    data,
  });
};

const findByShortCode = (shortCode) => {
  return prisma.url.findUnique({
    where: { shortCode },
  });
};

const findByUserId = (userId) => {
  return prisma.url.findMany({
    where: { userId },
  });
};

module.exports = {
  create,
  findByShortCode,
  findByUserId,
};
