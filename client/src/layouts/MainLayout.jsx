import { NavLink, Outlet, Link } from 'react-router'
import { HomeIcon, ChatIcon, UserIcon, SproutIcon } from '../components/Icons.jsx'

const NAV_ITEMS = [
  { to: '/', label: 'Beranda', icon: HomeIcon, end: true },
  { to: '/chat', label: 'Chat', icon: ChatIcon },
  { to: '/profil', label: 'Profil', icon: UserIcon },
]

function navClass({ isActive }) {
  return [
    'flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors',
    'md:flex-row md:gap-2 md:rounded-lg md:px-5 md:py-2 md:text-sm',
    isActive
      ? 'text-brand-700 md:bg-brand-50'
      : 'text-slate-500 hover:text-brand-700 md:hover:bg-slate-100',
  ].join(' ')
}

export default function MainLayout() {
  return (
    <div className="min-h-dvh pb-16 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-brand-700">
            <SproutIcon className="size-7" />
            <span className="text-lg font-extrabold tracking-tight">Growth Together</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                <Icon className="size-5" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      {/* Navigasi bawah untuk HP, karena kebanyakan orang tua membuka dari HP */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid h-16 grid-cols-3 border-t border-slate-200 bg-white md:hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navClass}>
            <Icon className="size-6" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
