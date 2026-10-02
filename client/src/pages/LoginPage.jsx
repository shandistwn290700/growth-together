import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import api, { getErrorMessage } from '../lib/api.js'
import { hasToken, useAuthActions } from '../lib/auth.js'
import { setupChatAfterLogin } from '../lib/chatSession.js'
import { motionDelay } from '../lib/motion.js'
import { SproutIcon } from '../components/Icons.jsx'
import { Alert, Button, Field, Input } from '../components/ui.jsx'
import AuthSplash from '../components/AuthSplash.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const { saveSession } = useAuthActions()
  const [form, setForm] = useState({ username: '', password: '' })
  const [welcome, setWelcome] = useState(null) // user yang baru login → tampilkan layar sambutan
  const [shake, setShake] = useState(false)

  const login = useMutation({
    mutationFn: async (body) => {
      const { data } = await api.post('/auth/login', body)
      saveSession(data)
      // Password hanya ada di memori saat ini, jadi kunci chat dibuka (atau dibuat) sekarang.
      await setupChatAfterLogin(data.user, body.password)
      return data
    },
    onSuccess: (data) => setWelcome(data.user),
    onError: () => setShake(true),
  })

  // Setelah layar sambutan tampil sebentar, masuk ke aplikasi.
  useEffect(() => {
    if (!welcome) return
    const timer = setTimeout(
      // Admin langsung masuk ke panel admin; guru & orang tua ke Beranda.
      () => navigate(welcome.mustChangePassword ? '/ganti-password' : welcome.role === 'admin' ? '/admin' : '/', { replace: true }),
      motionDelay(1100),
    )
    return () => clearTimeout(timer)
  }, [welcome, navigate])

  if (welcome) {
    return (
      <AuthSplash
        title={`Assalamu'alaikum, ${welcome.displayName}`}
        subtitle={welcome.mustChangePassword ? 'Silakan buat password baru terlebih dahulu' : 'Selamat datang di Growth Together'}
      />
    )
  }
  // Sudah login sebelumnya (bukan baru saja login di halaman ini): langsung ke beranda.
  if (hasToken() && login.isIdle) return <Navigate to="/" replace />

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <SproutIcon className="mx-auto size-14 origin-bottom animate-sprout-grow text-brand-700" />
          <h1 className="mt-2 animate-rise text-3xl font-extrabold text-brand-700" style={{ animationDelay: '150ms' }}>
            Growth Together
          </h1>
          <p className="mt-1 animate-rise text-sm text-slate-600" style={{ animationDelay: '250ms' }}>
            Bersama mendampingi tumbuh kembang ananda
          </p>
        </div>

        <div className="animate-auth-in" style={{ animationDelay: '300ms' }}>
          <form
            className={`space-y-4 rounded-2xl bg-white p-6 shadow-sm ${shake ? 'animate-shake' : ''}`}
            onAnimationEnd={() => setShake(false)}
            onSubmit={(e) => {
              e.preventDefault()
              login.mutate(form)
            }}
          >
            {login.isError && <Alert>{getErrorMessage(login.error)}</Alert>}
            <Field label="Username" hint="Orang tua: gunakan NIS ananda">
              <Input name="username" value={form.username} onChange={update} autoComplete="username" required autoFocus />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" value={form.password} onChange={update} autoComplete="current-password" required />
            </Field>
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Masuk…' : 'Masuk'}
            </Button>
            <p className="text-center text-xs text-slate-500">Lupa password? Hubungi admin sekolah.</p>
          </form>
        </div>
      </div>
    </div>
  )
}
