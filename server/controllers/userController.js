const { User } = require('../models');
const { generateTempPassword } = require('../helpers/password');

class UserController {
  static async listTeachers(req, res) {
    const teachers = await User.findAll({
      where: { role: 'teacher' },
      attributes: ['id', 'username', 'fullName', 'isActive', 'mustChangePassword'],
      order: [['fullName', 'ASC']],
    });
    res.json(teachers);
  }

  // Password sementara hanya ditampilkan sekali ke admin.
  // Catatan: riwayat chat terenkripsi milik pengguna ini tidak bisa dibuka lagi setelah reset.
  static async resetPassword(req, res) {
    const user = await User.findByPk(req.params.id);
    if (!user) throw { name: 'NotFound', message: 'Pengguna tidak ditemukan' };
    if (user.role === 'admin') {
      throw { name: 'Forbidden', message: 'Password admin hanya bisa diganti oleh admin itu sendiri' };
    }

    const password = generateTempPassword();
    user.password = password;
    user.mustChangePassword = true;
    await user.save();
    res.json({ username: user.username, password });
  }

  static async setActive(req, res) {
    const user = await User.findByPk(req.params.id);
    if (!user) throw { name: 'NotFound', message: 'Pengguna tidak ditemukan' };
    if (user.id === req.user.id) throw { name: 'BadRequest', message: 'Anda tidak bisa menonaktifkan akun sendiri' };

    await user.update({ isActive: Boolean(req.body?.isActive) });
    res.json(user);
  }
}

module.exports = UserController;
