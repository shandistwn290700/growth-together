const { ChatKey } = require('../models');

// Batas bawah iterasi PBKDF2 agar kunci privat yang terkunci tidak mudah ditebak password-nya.
const MIN_ITERATIONS = 100000;
const BASE64 = /^[A-Za-z0-9+/=]+$/;

// Kunci publik harus JWK ECDH P-256 dan TIDAK boleh berisi komponen privat ("d").
function parsePublicKey(value) {
  try {
    const jwk = JSON.parse(value);
    if (jwk.kty === 'EC' && jwk.crv === 'P-256' && jwk.x && jwk.y && !jwk.d) return JSON.stringify(jwk);
  } catch {
    // diteruskan ke error di bawah
  }
  throw { name: 'BadRequest', message: 'Kunci publik tidak valid' };
}

// Kunci privat yang sudah dikunci (dienkripsi) di browser dengan kunci turunan password.
function parseWrappedKey(body) {
  const { wrappedPrivateKey, salt, iv, iterations } = body ?? {};
  if (![wrappedPrivateKey, salt, iv].every((v) => typeof v === 'string' && BASE64.test(v)) || !(iterations >= MIN_ITERATIONS)) {
    throw { name: 'BadRequest', message: 'Data kunci chat tidak valid' };
  }
  return { wrappedPrivateKey, salt, iv, iterations: Number(iterations) };
}

const activeKeyOf = (userId, transaction) => ChatKey.findOne({ where: { userId, isActive: true }, transaction });

// Setelah reset password oleh admin, kunci lama tidak bisa dibuka lagi: hapus kunci privatnya,
// simpan kunci publiknya agar pesan lama tetap bisa dikenali.
const retireKeys = (userId, transaction) =>
  ChatKey.update(
    { isActive: false, wrappedPrivateKey: null, salt: null, iv: null },
    { where: { userId, isActive: true }, transaction },
  );

module.exports = { parsePublicKey, parseWrappedKey, activeKeyOf, retireKeys };
