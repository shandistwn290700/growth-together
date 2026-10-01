// Cek pengaturan .env saat server menyala, agar kesalahan konfigurasi langsung ketahuan
// (bukan baru muncul saat ada user yang login atau upload foto).
const isProduction = process.env.NODE_ENV === 'production';

function validateEnv() {
  const problems = [];
  const required = (name, hint) => !process.env[name] && problems.push(`${name} belum diisi${hint ? ` (${hint})` : ''}`);

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET minimal 32 karakter acak');
  }
  ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].forEach((name) => required(name));

  if (isProduction) {
    required('DATABASE_URL', 'contoh: postgres://user:password@host:5432/nama_db');
  } else {
    ['DB_USERNAME', 'DB_PASSWORD'].forEach((name) => required(name));
  }

  if (problems.length) {
    console.error('Pengaturan .env belum lengkap:\n- ' + problems.join('\n- '));
    process.exit(1);
  }
}

module.exports = { isProduction, validateEnv };
