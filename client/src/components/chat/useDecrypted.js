import { useEffect, useState } from 'react'
import { useMe } from '../../lib/auth.js'
import { cachedDecryption, decryptFor, ensurePublicKeys } from '../../lib/chatSession.js'
import { useLocalKey } from './chatState.js'

// Dekripsi daftar pesan di browser. Hasil: { [messageId]: { text } | { locked: true } }.
export function useDecrypted(messages) {
  const local = useLocalKey()
  const { data: me } = useMe()
  const [, rerender] = useState(0) // dipanggil setelah dekripsi selesai agar tampilan diperbarui

  useEffect(() => {
    const pending = messages.filter((m) => m && !cachedDecryption(m.id))
    if (!local || pending.length === 0) return
    let cancelled = false
    ;(async () => {
      // Ambil semua kunci publik yang dibutuhkan sekaligus.
      const keyIds = pending.map((m) => (m.senderId === me.id ? m.recipientKeyId : m.senderKeyId))
      await ensurePublicKeys(keyIds).catch(() => {})
      await Promise.all(pending.map((m) => decryptFor(local, m, me.id)))
      if (!cancelled) rerender((v) => v + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [messages, local, me.id])

  const result = {}
  messages.forEach((m) => {
    if (m) result[m.id] = cachedDecryption(m.id)
  })
  return result
}
