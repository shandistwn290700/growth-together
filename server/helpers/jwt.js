const jwt = require('jsonwebtoken');

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET belum diatur di .env');
  return process.env.JWT_SECRET;
};

const signToken = (payload) => jwt.sign(payload, secret(), { expiresIn: '7d' });
const verifyToken = (token) => jwt.verify(token, secret());

module.exports = { signToken, verifyToken };
