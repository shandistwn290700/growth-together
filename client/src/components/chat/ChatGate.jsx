import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { useMe } from '../../lib/auth.js'
import { loadLocalKey, unlockChat } from '../../lib/chatSession.js'
import { Alert, Button, Card, Field, Input, Spinner } from '../ui.jsx'
import { LocalKeyContext } from './chatState.js'

// Chat hanya bisa dibuka jika kunci privat di perangkat ini cocok dengan kunci aktif di server.
// Jika belum (perangkat baru, data browser dihapus, atau akun lama), minta password untuk membukanya.
export default function ChatGate({ children }) {
  const { data: me } = useMe()
  const status = useQuery({
    queryKey: ['chat-key', me.id],
    queryFn: async () => {
      const [local, server] = await Promise.all([loadLocalKey(me.id), api.get('/chat/keys/me').then((r) => r.data)])
      return { local, hasServerKey: Boolean(server), ready: Boolean(server && local?.keyId === server.id) }
    },
    staleTime: Infinity,
  })

  if (status.isPending) return <Spinner label="Menyiapkan chat terenkripsi…" />
  if (status.isError) return <Alert>{getErrorMessage(status.error)}</Alert>
  if (!status.data.ready) return <UnlockForm hasServerKey={status.data.hasServerKey} />

  return <LocalKeyContext.Provider value={status.data.local}>{children}</LocalKeyContext.Provider>
}

function UnlockForm({ hasServerKey }) {
  const { data: me } = useMe()
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')

  const unlock = useMutation({
    mutationFn: async () => {
      // Pastikan password benar dulu, agar kunci tidak terkunci dengan password yang salah ketik.
      await api.post('/auth/verify-password', { password })
      await unlockChat(me, password)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-key', me.id] }),
  })

  return (
    <Card className="mx-auto max-w-md space-y-4 text-center">
      <div className="text-5xl">🔐</div>
      <div>
        <h1 className="text-xl font-bold">{hasServerKey ? 'Buka chat di perangkat ini' : 'Aktifkan chat terenkripsi'}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {hasServerKey
            ? 'Masukkan password Anda untuk membuka kunci chat. Pesan hanya bisa dibaca oleh Anda dan lawan bicara.'
            : 'Kunci enkripsi akan dibuat di perangkat ini dan dikunci dengan password Anda. Pihak sekolah pun tidak bisa membaca isi chat.'}
        </p>
      </div>
      <form
        className="space-y-3 text-left"
        onSubmit={(e) => {
          e.preventDefault()
          unlock.mutate()
        }}
      >
        {unlock.isError && (
          <Alert>{unlock.error.response ? getErrorMessage(unlock.error) : 'Kunci chat tidak bisa dibuka dengan password ini'}</Alert>
        )}
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus />
        </Field>
        <Button type="submit" className="w-full" disabled={unlock.isPending}>
          {unlock.isPending ? 'Membuka…' : hasServerKey ? 'Buka chat' : 'Aktifkan chat'}
        </Button>
      </form>
      <p className="text-xs text-slate-500">
        Catatan: jika password Anda di-reset oleh admin, riwayat chat lama tidak bisa dibuka lagi.
      </p>
    </Card>
  )
}
