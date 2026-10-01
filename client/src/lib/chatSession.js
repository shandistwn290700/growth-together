// Mengelola kunci chat di browser: membuka/membuat kunci saat login, menyimpannya di IndexedDB,
// serta enkripsi/dekripsi pesan dengan cache kunci bersama per lawan bicara.
import { get, set, del } from 'idb-keyval'
import api from './api.js'
import {
  createKeyBundle,
  decryptMessage,
  deriveSharedKey,
  encryptMessage,
  importPublicKey,
  relockPrivateKey,
  unlockPrivateKey,
} from './crypto.js'

export const CHAT_KEY_STORE = 'gt-chat-private-key'
export const canUseChat = (user) => ['teacher', 'parent'].includes(user?.role) && !user?.mustChangePassword

// Cadangan di memori jika IndexedDB tidak tersedia (misalnya mode privat di sebagian browser).
let memoryKey = null
const publicKeys = new Map() // keyId -> Promise<CryptoKey>
const sharedKeys = new Map() // "myKeyId:theirKeyId" -> Promise<CryptoKey>
const decrypted = new Map() // messageId -> { text } | { locked: true }

export async function loadLocalKey(userId) {
  if (memoryKey?.userId === userId) return memoryKey
  try {
    const stored = await get(CHAT_KEY_STORE)
    return stored?.userId === userId ? stored : null
  } catch {
    return null
  }
}

async function saveLocalKey(userId, keyId, privateKey) {
  if (memoryKey?.keyId !== keyId) {
    sharedKeys.clear()
    decrypted.clear()
  }
  memoryKey = { userId, keyId, privateKey }
  try {
    await set(CHAT_KEY_STORE, memoryKey) // CryptoKey non-extractable tetap tidak bisa diekspor dari IndexedDB
  } catch {
    // tetap jalan dengan kunci di memori
  }
  return memoryKey
}

export async function clearLocalKey() {
  memoryKey = null
  sharedKeys.clear()
  decrypted.clear()
  try {
    await del(CHAT_KEY_STORE)
  } catch {
    // abaikan
  }
}

// Buka kunci chat yang sudah ada, atau buat baru jika belum ada. Butuh password asli user.
export async function unlockChat(user, password, retried = false) {
  const { data: mine } = await api.get('/chat/keys/me')
  if (mine) return saveLocalKey(user.id, mine.id, await unlockPrivateKey(mine, password))

  const bundle = await createKeyBundle(password)
  try {
    const { data } = await api.post('/chat/keys', bundle.upload)
    return saveLocalKey(user.id, data.id, bundle.privateKey)
  } catch (err) {
    // Tab lain baru saja membuat kunci: pakai kunci itu.
    if (err.response?.status === 409 && !retried) return unlockChat(user, password, true)
    throw err
  }
}

// Dipanggil setelah login. Kegagalan tidak menghalangi login; chat bisa dibuka nanti dengan password.
export async function setupChatAfterLogin(user, password) {
  if (!canUseChat(user)) return
  try {
    await unlockChat(user, password)
  } catch (err) {
    console.warn('Chat belum bisa dibuka:', err)
  }
}

// Saat ganti password: kunci privat dikunci ulang dengan password baru.
export async function relockForPasswordChange(user, oldPassword, newPassword) {
  if (!canUseChat(user)) return undefined
  const { data: mine } = await api.get('/chat/keys/me')
  if (!mine) return undefined
  try {
    return await relockPrivateKey(mine, oldPassword, newPassword)
  } catch {
    throw new Error('Password lama salah')
  }
}

// ---------- Kunci publik & kunci bersama ----------

export function rememberPublicKeys(keys) {
  keys.forEach((k) => {
    if (k && !publicKeys.has(k.id)) publicKeys.set(k.id, importPublicKey(k.publicKey))
  })
}

export async function ensurePublicKeys(ids) {
  const missing = [...new Set(ids)].filter((id) => !publicKeys.has(id))
  if (missing.length === 0) return
  const { data } = await api.get('/chat/keys', { params: { ids: missing.join(',') } })
  rememberPublicKeys(data)
}

function sharedKeyFor(local, theirKeyId) {
  const cacheKey = `${local.keyId}:${theirKeyId}`
  if (!sharedKeys.has(cacheKey)) {
    const promise = (async () => {
      await ensurePublicKeys([theirKeyId])
      const publicKey = publicKeys.get(theirKeyId)
      if (!publicKey) throw new Error('Kunci publik tidak ditemukan')
      return deriveSharedKey(local.privateKey, await publicKey)
    })()
    promise.catch(() => sharedKeys.delete(cacheKey))
    sharedKeys.set(cacheKey, promise)
  }
  return sharedKeys.get(cacheKey)
}

// ---------- Pesan ----------

export function cachedDecryption(messageId) {
  return decrypted.get(messageId)
}

export async function decryptFor(local, message, myUserId) {
  if (decrypted.has(message.id)) return decrypted.get(message.id)
  const mine = message.senderId === myUserId
  const myKeyId = mine ? message.senderKeyId : message.recipientKeyId
  const theirKeyId = mine ? message.recipientKeyId : message.senderKeyId

  let result
  if (myKeyId !== local.keyId) {
    result = { locked: true } // dienkripsi untuk kunci lama (sebelum reset password)
  } else {
    try {
      result = { text: await decryptMessage(await sharedKeyFor(local, theirKeyId), message) }
    } catch {
      result = { locked: true }
    }
  }
  decrypted.set(message.id, result)
  return result
}

export async function encryptFor(local, counterpartKey, text, myUserId) {
  rememberPublicKeys([counterpartKey])
  const sharedKey = await sharedKeyFor(local, counterpartKey.id)
  return {
    ...(await encryptMessage(sharedKey, text, myUserId)),
    senderKeyId: local.keyId,
    recipientKeyId: counterpartKey.id,
  }
}
