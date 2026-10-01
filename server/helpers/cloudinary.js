require('dotenv').config({ quiet: true });
const { v2: cloudinary } = require('cloudinary');

const REQUIRED = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length === 0) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Semua foto/video disimpan sebagai "authenticated": tidak bisa dibuka tanpa URL bertanda tangan
// dari server, jadi hanya pengguna yang berhak yang mendapatkan link-nya.
const DELIVERY_TYPE = 'authenticated';
const FOLDER = process.env.CLOUDINARY_FOLDER || 'growth-together';

function assertConfigured() {
  if (missing.length) throw new Error(`Variabel Cloudinary belum diisi di .env: ${missing.join(', ')}`);
}

module.exports = { cloudinary, DELIVERY_TYPE, FOLDER, assertConfigured };
