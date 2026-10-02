import { useState } from 'react'
import { Link } from 'react-router'
import { KeyRound, LayoutDashboard, LogOut, Newspaper } from 'lucide-react'
import { ROLE_LABELS, useAuthActions } from '../lib/auth.js'
import { motionDelay } from '../lib/motion.js'
import { useDismiss } from '../lib/useDismiss.js'
import { Avatar } from './ui.jsx'
import { IconBadge } from './Icons.jsx'
import AuthSplash from './AuthSplash.jsx'

// Avatar di pojok kanan atas: lihat profil, ganti password, pindah Beranda/Panel admin, keluar.
// Dipakai di tata letak utama (Beranda) dan di panel admin.
export default function AccountMenu({ me, inAdminPanel = false }) {
  const { logout } = useAuthActions()
  const [open, setOpen] = useState(false)
  const [farewell, setFarewell] = useState(false)
  const ref = useDismiss(open, setOpen)

  // Logout: tampilkan layar perpisahan sebentar, lalu hapus sesi dan kembali ke halaman login.
  const startLogout = () => {
    setOpen(false)
    setFarewell(true)
    setTimeout(logout, motionDelay(800))
  }

  const item = 'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-slate-100'
  const close = () => setOpen(false)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full ring-brand-100 hover:ring-4"
        aria-label="Menu akun"
        aria-expanded={open}
      >
        <Avatar name={me.displayName} src={me.avatarUrl} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-72 origin-top-right animate-menu-in rounded-xl bg-white p-2 text-slate-800 shadow-xl ring-1 ring-slate-200"
        >
          <Link to="/profil" onClick={close} className="flex items-center gap-3 rounded-lg p-2 shadow-sm ring-1 ring-slate-100 hover:bg-slate-50">
            <Avatar name={me.displayName} src={me.avatarUrl} />
            <div className="min-w-0">
              <div className="truncate font-bold">{me.displayName}</div>
              <div className="text-xs text-slate-500">{ROLE_LABELS[me.role]} · lihat profil</div>
            </div>
          </Link>
          <div className="mt-2 space-y-0.5">
            {me.role === 'admin' &&
              (inAdminPanel ? (
                <Link to="/" onClick={close} className={item} role="menuitem">
                  <IconBadge icon={Newspaper} />
                  Lihat Beranda
                </Link>
              ) : (
                <Link to="/admin" onClick={close} className={item} role="menuitem">
                  <IconBadge icon={LayoutDashboard} />
                  Panel admin
                </Link>
              ))}
            <Link to="/ganti-password" onClick={close} className={item} role="menuitem">
              <IconBadge icon={KeyRound} />
              Ganti password
            </Link>
            <button onClick={startLogout} className={item} role="menuitem">
              <IconBadge icon={LogOut} />
              Keluar
            </button>
          </div>
        </div>
      )}
      {farewell && <AuthSplash title={`Sampai jumpa, ${me.displayName}`} subtitle="Semoga harimu menyenangkan" />}
    </div>
  )
}
