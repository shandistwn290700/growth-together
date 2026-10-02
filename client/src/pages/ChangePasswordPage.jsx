import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import api, { getErrorMessage } from '../lib/api.js'
import { useAuthActions, useMe } from '../lib/auth.js'
import { relockForPasswordChange, setupChatAfterLogin } from '../lib/chatSession.js'
import { Alert, Button, Field, Input } from '../components/ui.jsx'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { saveSession, logout } = useAuthActions()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [localError, setLocalError] = useState('')

  const change = useMutation({
    mutationFn: async (body) => {
      // Kunci chat dikunci ulang dengan password baru agar riwayat chat tetap bisa dibuka.
      const chatKey = await relockForPasswordChange(me, body.currentPassword, body.newPassword)
      const { data } = await api.patch('/auth/password', { ...body, chatKey })
      saveSession(data)
      await setupChatAfterLogin(data.user, body.newPassword)
      return data
    },
    onSuccess: (data) => navigate(data.user.role === 'admin' ? '/admin' : '/', { replace: true }),
  })

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    setLocalError('')
    if (form.newPassword.length < 8) return setLocalError('Password baru minimal 8 karakter')
    if (form.newPassword !== form.confirmPassword) return setLocalError('Konfirmasi password tidak sama')
    change.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword })
  }

  const error =
    localError || (change.isError && (change.error.response ? getErrorMessage(change.error) : change.error.message))

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm animate-auth-in space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-brand-700">Ganti Password</h1>
          {me?.mustChangePassword && (
            <p className="mt-1 text-sm text-slate-600">
              Assalamu'alaikum, <b>{me.displayName}</b>. Demi keamanan, silakan ganti password awal dari sekolah.
            </p>
          )}
        </div>
        {error && <Alert>{error}</Alert>}
        <Field label="Password lama">
          <Input name="currentPassword" type="password" value={form.currentPassword} onChange={update} autoComplete="current-password" required />
        </Field>
        <Field label="Password baru" hint="Minimal 8 karakter">
          <Input name="newPassword" type="password" value={form.newPassword} onChange={update} autoComplete="new-password" required />
        </Field>
        <Field label="Ulangi password baru">
          <Input name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} autoComplete="new-password" required />
        </Field>
        <Button type="submit" className="w-full" disabled={change.isPending}>
          {change.isPending ? 'Menyimpan…' : 'Simpan Password'}
        </Button>
        {me?.mustChangePassword ? (
          <button type="button" onClick={logout} className="w-full text-center text-sm text-slate-500 hover:underline">
            Keluar
          </button>
        ) : (
          <Link to="/profil" className="block text-center text-sm text-slate-500 hover:underline">
            Kembali
          </Link>
        )}
      </form>
    </div>
  )
}
