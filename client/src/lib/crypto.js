// Enkripsi end-to-end untuk chat, memakai Web Crypto API bawaan browser.
//
// - Setiap user punya pasangan kunci ECDH P-256. Kunci publik disimpan di server apa adanya.
// - Kunci privat dikunci (AES-GCM) dengan kunci turunan password (PBKDF2-SHA256) sebelum dikirim
//   ke server, jadi server hanya menyimpan versi terkunci yang tidak bisa dibukanya.
// - Kunci pesan = ECDH(kunci privat saya, kunci publik lawan bicara) → AES-256-GCM.
// - ID pengirim ikut diautentikasi (additional data), jadi server tidak bisa memalsukan siapa pengirimnya.

const subtle = globalThis.crypto.subtle
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const PBKDF2_ITERATIONS = 600_000
const ECDH = { name: 'ECDH', namedCurve: 'P-256' }

export function toBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function fromBase64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}

const randomBytes = (length) => globalThis.crypto.getRandomValues(new Uint8Array(length))

async function passwordKey(password, salt, iterations) {
  const material = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function lockPkcs8(pkcs8, password) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await passwordKey(password, salt, PBKDF2_ITERATIONS)
  const wrapped = await subtle.encrypt({ name: 'AES-GCM', iv }, key, pkcs8)
  return { wrappedPrivateKey: toBase64(wrapped), salt: toBase64(salt), iv: toBase64(iv), iterations: PBKDF2_ITERATIONS }
}

async function unlockPkcs8(bundle, password) {
  const key = await passwordKey(password, fromBase64(bundle.salt), bundle.iterations)
  // Gagal (OperationError) jika password salah.
  return subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(bundle.iv) }, key, fromBase64(bundle.wrappedPrivateKey))
}

// Kunci privat di memori/IndexedDB dibuat non-extractable: tidak bisa diekspor oleh script mana pun.
const importPrivateKey = (pkcs8) => subtle.importKey('pkcs8', pkcs8, ECDH, false, ['deriveKey'])

// Buat pasangan kunci baru. Hasil: data untuk server + kunci privat siap pakai.
export async function createKeyBundle(password) {
  const pair = await subtle.generateKey(ECDH, true, ['deriveKey'])
  const publicJwk = await subtle.exportKey('jwk', pair.publicKey)
  const pkcs8 = await subtle.exportKey('pkcs8', pair.privateKey)
  return {
    upload: { publicKey: JSON.stringify(publicJwk), ...(await lockPkcs8(pkcs8, password)) },
    privateKey: await importPrivateKey(pkcs8),
  }
}

export async function unlockPrivateKey(bundle, password) {
  return importPrivateKey(await unlockPkcs8(bundle, password))
}

// Saat ganti password: buka dengan password lama, kunci ulang dengan password baru.
export async function relockPrivateKey(bundle, oldPassword, newPassword) {
  return lockPkcs8(await unlockPkcs8(bundle, oldPassword), newPassword)
}

export function importPublicKey(jwkText) {
  return subtle.importKey('jwk', JSON.parse(jwkText), ECDH, false, [])
}

export function deriveSharedKey(privateKey, publicKey) {
  return subtle.deriveKey({ name: 'ECDH', public: publicKey }, privateKey, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
}

const senderData = (senderId) => encoder.encode(`gt-chat:sender:${senderId}`)

export async function encryptMessage(sharedKey, text, senderId) {
  const iv = randomBytes(12)
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: senderData(senderId) },
    sharedKey,
    encoder.encode(text),
  )
  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) }
}

export async function decryptMessage(sharedKey, { ciphertext, iv, senderId }) {
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv), additionalData: senderData(senderId) },
    sharedKey,
    fromBase64(ciphertext),
  )
  return decoder.decode(plain)
}
