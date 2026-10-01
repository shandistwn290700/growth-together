const { verifyToken } = require('../helpers/jwt');
const { User, Student } = require('../models');

module.exports = async (req, res, next) => {
  const [type, token] = (req.headers.authorization || '').split(' ');
  if (type !== 'Bearer' || !token) {
    throw { name: 'Unauthorized', message: 'Silakan login terlebih dahulu' };
  }

  const payload = verifyToken(token);
  const user = await User.findByPk(payload.id, { include: { model: Student, as: 'student' } });
  if (!user || !user.isActive) {
    throw { name: 'Unauthorized', message: 'Akun tidak ditemukan atau sudah dinonaktifkan' };
  }
  // Token lama tidak berlaku lagi setelah password diganti/di-reset.
  if (payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw { name: 'Unauthorized', message: 'Password telah diganti, silakan login kembali' };
  }

  req.user = user;
  next();
};
