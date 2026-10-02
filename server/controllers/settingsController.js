const { AppSetting } = require('../models');

// Tema warna yang boleh dipilih admin. Daftar warnanya sendiri ada di client (client/src/lib/theme.js);
// semua pilihan sudah dicek agar tulisan putih di atas tombol tetap mudah dibaca.
const THEMES = ['toska', 'biru', 'langit', 'nila', 'ungu', 'zamrud', 'merah-muda', 'jingga'];
const DEFAULT_APPEARANCE = { theme: 'toska' };

class SettingsController {
  // GET /settings/appearance — publik, karena halaman login juga memakai tema sekolah.
  static async getAppearance(req, res) {
    const setting = await AppSetting.findByPk('appearance');
    res.json({ ...DEFAULT_APPEARANCE, ...setting?.value });
  }

  // PUT /admin/settings/appearance  body: { theme }
  static async updateAppearance(req, res) {
    const theme = req.body?.theme;
    if (!THEMES.includes(theme)) throw { name: 'BadRequest', message: 'Pilihan tema tidak tersedia' };

    await AppSetting.upsert({ key: 'appearance', value: { theme } });
    res.json({ theme });
  }
}

module.exports = SettingsController;
