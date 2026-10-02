import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import {
  CalendarRange,
  FileArchive,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Newspaper,
  Palette,
  Presentation,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useMe } from '../lib/auth.js'
import { SproutIcon } from '../components/Icons.jsx'
import { Avatar, Spinner } from '../components/ui.jsx'
import AccountMenu from '../components/AccountMenu.jsx'

// Menu panel admin, dikelompokkan seperti template Gentelella.
const MENU = [
  {
    title: 'Umum',
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Data sekolah',
    items: [
      { to: '/admin/kelas', label: 'Kelas', icon: GraduationCap },
      { to: '/admin/siswa', label: 'Siswa & Orang Tua', icon: Users },
      { to: '/admin/guru', label: 'Guru', icon: Presentation },
      { to: '/admin/tahun-ajaran', label: 'Tahun Ajaran', icon: CalendarRange },
      { to: '/admin/import', label: 'Import Akun', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'Konten & tampilan',
    items: [
      { to: '/admin/moderasi', label: 'Moderasi Postingan', icon: ShieldCheck },
      { to: '/admin/laporan', label: 'Laporan', icon: FileArchive },
      { to: '/admin/tema', label: 'Tema Warna', icon: Palette },
    ],
  },
]

function Sidebar({ me, onNavigate }) {
  return (
    <div className="flex h-full flex-col bg-brand-900 text-brand-100">
      <Link to="/admin" onClick={onNavigate} className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-4 text-white">
        <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
          <SproutIcon className="size-5" />
        </span>
        <span className="text-lg font-extrabold tracking-tight">Growth Together</span>
      </Link>

      {/* Profil singkat seperti di Gentelella */}
      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar name={me.displayName} src={me.avatarUrl} />
        <div className="min-w-0 leading-tight">
          <div className="text-xs text-brand-200">Selamat datang,</div>
          <div className="truncate font-bold text-white">{me.displayName}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6" aria-label="Menu admin">
        {MENU.map((group) => (
          <div key={group.title}>
            <h2 className="px-3 pb-1.5 text-[11px] font-bold tracking-wider text-brand-300 uppercase">{group.title}</h2>
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                        isActive ? 'bg-white text-brand-800 shadow-sm' : 'text-brand-100 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="size-[18px] shrink-0" strokeWidth={2.2} />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <Link
        to="/"
        onClick={onNavigate}
        className="m-3 flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
      >
        <Newspaper className="size-4" strokeWidth={2.2} /> Lihat Beranda
      </Link>
    </div>
  )
}

// Panel admin terpisah dari timeline: sidebar gelap di kiri, bilah atas putih, konten di kanan.
export default function AdminLayout() {
  const { data: me } = useMe()
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  // Laci menu di HP: tutup dengan Escape, dan halaman di belakangnya tidak ikut tergulir.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <div className="min-h-dvh bg-slate-100 lg:pl-64">
      {/* Laptop: sidebar tetap */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <Sidebar me={me} />
      </aside>

      {/* HP & tablet: sidebar sebagai laci */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu admin">
          <button className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setDrawerOpen(false)} aria-label="Tutup menu" />
          <aside className="relative h-full w-72 max-w-[85vw] animate-page-in shadow-2xl">
            <Sidebar me={me} onNavigate={() => setDrawerOpen(false)} />
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-3 -right-12 flex size-10 items-center justify-center rounded-full bg-white text-slate-700 shadow"
              aria-label="Tutup menu"
            >
              <X className="size-5" />
            </button>
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex size-10 items-center justify-center rounded-lg text-brand-700 hover:bg-slate-100 lg:hidden"
          aria-label="Buka menu admin"
        >
          <Menu className="size-6" />
        </button>
        <span className="truncate font-bold text-slate-700">Panel Admin</span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/"
            className="hidden items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 sm:flex"
          >
            <Newspaper className="size-4" strokeWidth={2.2} /> Lihat Beranda
          </Link>
          <AccountMenu me={me} inAdminPanel />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
        <div key={pathname} className="animate-page-in">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
