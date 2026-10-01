const { User, Student } = require('../models');
const { comparePassword } = require('../helpers/bcrypt');
const { signToken } = require('../helpers/jwt');
const toUserDto = require('../helpers/userDto');
const { validateUploadedMedia, deleteFromCloudinary } = require('../helpers/media');

class AuthController {
  static async login(req, res) {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      throw { name: 'BadRequest', message: 'Username dan password wajib diisi' };
    }

    const user = await User.findOne({
      where: { username: String(username).trim().toLowerCase() },
      include: { model: Student, as: 'student' },
    });
    // Pesan sengaja disamakan agar orang lain tidak bisa menebak username mana yang terdaftar.
    if (!user || !(await comparePassword(String(password), user.password))) {
      throw { name: 'Unauthorized', message: 'Username atau password salah' };
    }
    if (!user.isActive) {
      throw { name: 'Unauthorized', message: 'Akun sudah dinonaktifkan, hubungi admin sekolah' };
    }

    res.json({ access_token: signToken({ id: user.id }), user: toUserDto(user) });
  }

  static async me(req, res) {
    res.json(toUserDto(req.user));
  }

  // PUT /auth/avatar — foto profil guru/admin. Orang tua memakai foto anaknya (PUT /students/:id/photo).
  static async updateAvatar(req, res) {
    if (req.user.role === 'parent') {
      throw { name: 'BadRequest', message: 'Foto profil orang tua mengikuti foto ananda' };
    }
    const [photo] = validateUploadedMedia(req.user.id, [{ ...req.body, resourceType: 'image' }], 'avatar');
    const oldPublicId = req.user.avatarPublicId;
    await req.user.update({ avatarPublicId: photo.publicId });
    if (oldPublicId) {
      deleteFromCloudinary([{ type: 'image', publicId: oldPublicId }]).catch((err) =>
        console.error('Gagal menghapus foto lama:', err.error?.message ?? err.message),
      );
    }
    res.json(toUserDto(req.user));
  }

  static async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      throw { name: 'BadRequest', message: 'Password lama dan password baru wajib diisi' };
    }
    if (!(await comparePassword(String(currentPassword), req.user.password))) {
      throw { name: 'BadRequest', message: 'Password lama salah' };
    }
    if (currentPassword === newPassword) {
      throw { name: 'BadRequest', message: 'Password baru harus berbeda dari password lama' };
    }

    req.user.password = String(newPassword);
    req.user.mustChangePassword = false;
    await req.user.save();

    // Token lama otomatis tidak berlaku, jadi kirim token baru.
    res.json({ access_token: signToken({ id: req.user.id }), user: toUserDto(req.user) });
  }
}

module.exports = AuthController;
