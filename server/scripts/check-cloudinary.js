// Cek koneksi Cloudinary: npm run check:cloudinary
// Mengunggah 1 gambar uji berukuran 1x1 piksel, memastikan gambar itu privat, lalu menghapusnya lagi.
const { cloudinary, DELIVERY_TYPE, FOLDER, assertConfigured } = require('../helpers/cloudinary');

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function main() {
  assertConfigured();

  await cloudinary.api.ping();
  console.log('✓ Kredensial valid, terhubung ke cloud:', cloudinary.config().cloud_name);

  const uploaded = await cloudinary.uploader.upload(TINY_PNG, { folder: `${FOLDER}/_check`, type: DELIVERY_TYPE });
  console.log('✓ Upload berhasil:', uploaded.public_id);

  try {
    const signedUrl = cloudinary.url(uploaded.public_id, {
      type: DELIVERY_TYPE,
      sign_url: true,
      version: uploaded.version,
    });
    const unsignedUrl = cloudinary.url(uploaded.public_id, { type: DELIVERY_TYPE, version: uploaded.version });

    const signed = await fetch(signedUrl);
    const unsigned = await fetch(unsignedUrl);
    console.log(`${signed.ok ? '✓' : '✗'} URL bertanda tangan bisa dibuka (status ${signed.status})`);
    console.log(`${!unsigned.ok ? '✓' : '✗'} URL tanpa tanda tangan ditolak (status ${unsigned.status})`);
    if (!signed.ok || unsigned.ok) process.exitCode = 1;
  } finally {
    await cloudinary.uploader.destroy(uploaded.public_id, { type: DELIVERY_TYPE, invalidate: true });
    console.log('✓ Gambar uji sudah dihapus');
  }

  console.log(process.exitCode ? '\nAda pemeriksaan yang gagal.' : '\nCloudinary siap dipakai.');
}

main().catch((err) => {
  const message = err.error?.message ?? err.message;
  console.error('✗ Gagal:', message);
  if (err.error?.http_code === 401) console.error('  Periksa lagi API Key dan API Secret di .env');
  process.exit(1);
});
