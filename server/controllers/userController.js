const { AcademicYear, Classroom, User, sequelize } = require('../models');
const { generateTempPassword } = require('../helpers/password');
const { retireKeys } = require('../services/chatKeys');
const { disconnectUser } = require('../socket');

class UserController {
  // Daftar guru beserta kelas yang diampu di tahun ajaran aktif dan waktu login terakhir.
  static async listTeachers(req, res) {
    const year = await AcademicYear.findOne({ where: { isActive: true } });
    const teachers = await User.findAll({
      where: { role: 'teacher' },
      attributes: ['id', 'username', 'fullName', 'isActive', 'mustChangePassword', 'lastLoginAt'],
      include: {
        model: Classroom,
        as: 'teachingClassrooms',
        attributes: ['id', 'grade', 'name'],
        through: { attributes: [] },
        where: { academicYearId: year?.id ?? 0 },
        required: false,
      },
      order: [['fullName', 'ASC']],
    });
    res.json(
      teachers.map((t) => ({
        id: t.id,
        username: t.username,
        fullName: t.fullName,
        isActive: t.isActive,
        mustChangePassword: t.mustChangePassword,
        lastLoginAt: t.lastLoginAt,
        classrooms: t.teachingClassrooms.map((c) => ({ id: c.id, label: c.label })),
      })),
    );
  }

  // Password sementara hanya ditampilkan sekali ke admin.
  // Kunci chat lama ikut dinonaktifkan: riwayat chat terenkripsi pengguna ini tidak bisa dibuka lagi.
  static async resetPassword(req, res) {
    const user = await User.findByPk(req.params.id);
    if (!user) throw { name: 'NotFound', message: 'Pengguna tidak ditemukan' };
    if (user.role === 'admin') {
      throw { name: 'Forbidden', message: 'Password admin hanya bisa diganti oleh admin itu sendiri' };
    }

    const password = generateTempPassword();
    await sequelize.transaction(async (transaction) => {
      user.password = password;
      user.mustChangePassword = true;
      await user.save({ transaction });
      await retireKeys(user.id, transaction);
    });
    disconnectUser(user.id);
    res.json({ username: user.username, password });
  }

  static async setActive(req, res) {
    const user = await User.findByPk(req.params.id);
    if (!user) throw { name: 'NotFound', message: 'Pengguna tidak ditemukan' };
    if (user.id === req.user.id) throw { name: 'BadRequest', message: 'Anda tidak bisa menonaktifkan akun sendiri' };

    await user.update({ isActive: Boolean(req.body?.isActive) });
    if (!user.isActive) disconnectUser(user.id);
    res.json(user);
  }
}

module.exports = UserController;
