const { AppSetting } = require('../models');

// Tema warna yang boleh dipilih admin. Daftar warnanya sendiri ada di client (client/src/lib/theme.js);
// semua pilihan sudah dicek agar tulisan putih di atas tombol tetap mudah dibaca.
// Warna utama (shade 700) juga dipakai server untuk kop laporan PDF.
const THEME_COLORS = {
  toska: '#0f766e',
  biru: '#1d4ed8',
  langit: '#0369a1',
  nila: '#4338ca',
  ungu: '#6d28d9',
  zamrud: '#047857',
  'merah-muda': '#be123c',
  jingga: '#c2410c',
};
const DEFAULT_APPEARANCE = { theme: 'toska', schoolName: '' };

async function loadAppearance() {
  const setting = await AppSetting.findByPk('appearance');
  return { ...DEFAULT_APPEARANCE, ...setting?.value };
}

class SettingsController {
  // GET /settings/appearance — publik, karena halaman login juga memakai tema & nama sekolah.
  static async getAppearance(req, res) {
    res.json(await loadAppearance());
  }

  // PUT /admin/settings/appearance  body: { theme?, schoolName? }
  static async updateAppearance(req, res) {
    const current = await loadAppearance();
    const next = { ...current };

    if (req.body?.theme !== undefined) {
      if (!THEME_COLORS[req.body.theme]) throw { name: 'BadRequest', message: 'Pilihan tema tidak tersedia' };
      next.theme = req.body.theme;
    }
    if (req.body?.schoolName !== undefined) {
      const name = String(req.body.schoolName).trim();
      if (name.length > 100) throw { name: 'BadRequest', message: 'Nama sekolah maksimal 100 karakter' };
      next.schoolName = name;
    }

    await AppSetting.upsert({ key: 'appearance', value: next });
    res.json(next);
  }
}

module.exports = SettingsController;
// Nama berbeda dari method SettingsController.getAppearance agar tidak menimpanya.
module.exports.loadAppearance = loadAppearance;
module.exports.THEME_COLORS = THEME_COLORS;
