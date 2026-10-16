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

const findAndCountByUserId = ({ userId, skip, limit }) => {
  return prisma.$transaction([
    prisma.url.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.url.count({
      where: { userId },
    }),
  ]);
};

const findById = (id) => {
  return prisma.url.findUnique({
    where: { id },
  });
};

const update = (id, data) => {
  return prisma.url.update({
    where: { id },
    data,
  });
};

const deleteById = (id) => {
  return prisma.url.delete({
    where: { id },
  });
};

module.exports = {
  create,
  findByShortCode,
  findByUserId,
  findAndCountByUserId,
  findById,
  update,
  deleteById,
};
