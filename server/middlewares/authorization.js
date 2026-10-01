// Contoh pemakaian: router.post('/', authorize('admin'), handler)
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw { name: 'Forbidden', message: 'Anda tidak memiliki akses untuk tindakan ini' };
    }
    next();
  };

// Akun baru (hasil import / reset) harus ganti password dulu sebelum memakai fitur lain.
const requirePasswordChanged = (req, res, next) => {
  if (req.user.mustChangePassword) {
    throw { name: 'Forbidden', message: 'Silakan ganti password Anda terlebih dahulu' };
  }
  next();
};

module.exports = { authorize, requirePasswordChanged };
