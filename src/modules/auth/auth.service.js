const bcrypt = require('bcrypt');
const authRepository = require('./auth.repository');
const { signToken } = require('../../utils/jwt');

const register = async ({ name, email, password }) => {
  const existingUser = await authRepository.findByEmail(email);

  if (existingUser) {
    const error = new Error('Email is already registered.');
    error.status = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await authRepository.create({
    name,
    email,
    password: hashedPassword,
  });

  const token = signToken({
    id: user.id,
    email: user.email,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    token,
  };
};

const login = async ({ email, password }) => {
  const user = await authRepository.findByEmail(email);

  if (!user) {
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }

  const checkPassword = await bcrypt.compare(password, user.password);

  if (!checkPassword) {
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }

  const token = signToken({
    id: user.id,
    email: user.email,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    token,
  };
};

module.exports = {
  register,
  login,
};
