const prisma = require('../../infrastructure/database');

const findByEmail = (email) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

const create = (data) => {
  return prisma.user.create({
    data,
  });
};

const findById = (id) => {
  return prisma.user.findUnique({
    where: { id },
  });
};

module.exports = {
  findByEmail,
  create,
  findById,
};
