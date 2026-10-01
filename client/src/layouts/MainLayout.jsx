import { NavLink, Outlet, Link } from 'react-router'
import { HomeIcon, ChatIcon, UserIcon, SproutIcon, ClassIcon, ShieldIcon, LogoutIcon } from '../components/Icons.jsx'
import { ROLE_LABELS, useAuthActions, useMe } from '../lib/auth.js'
import { ChatProvider } from '../components/chat/ChatProvider.jsx'
import { useUnreadCount } from '../components/chat/chatState.js'

// Menu yang tampil tergantung peran. Chat hanya untuk guru ↔ orang tua.
const NAV_ITEMS = [
  { to: '/', label: 'Beranda', icon: HomeIcon, end: true, roles: ['admin', 'teacher', 'parent'] },
  { to: '/kelas', label: 'Kelas', icon: ClassIcon, roles: ['admin', 'teacher'] },
  { to: '/chat', label: 'Chat', icon: ChatIcon, roles: ['teacher', 'parent'] },
  { to: '/admin', label: 'Admin', icon: ShieldIcon, roles: ['admin'] },
  { to: '/profil', label: 'Profil', icon: UserIcon, roles: ['admin', 'teacher', 'parent'] },
]

function navClass({ isActive }) {
  return [
    'flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors',
    'md:flex-row md:gap-2 md:rounded-lg md:px-4 md:py-2 md:text-sm',
    isActive
      ? 'text-brand-700 md:bg-brand-50'
      : 'text-slate-500 hover:text-brand-700 md:hover:bg-slate-100',
  ].join(' ')
}

// Ikon menu dengan badge jumlah pesan belum dibaca (khusus menu Chat).
function NavIcon({ icon: Icon, badge, className }) {
  return (
    <span className="relative">
      <Icon className={className} />
      {badge > 0 && (
        <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </span>
  )
}

export default function MainLayout() {
  return (
    <ChatProvider>
      <Layout />
    </ChatProvider>
  )
}

function Layout() {
  const { data: me } = useMe()
  const { logout } = useAuthActions()
  const { data: unread = 0 } = useUnreadCount()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(me.role))
  const badgeFor = (to) => (to === '/chat' ? unread : 0)

  return (
    <div className="min-h-dvh pb-16 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 text-brand-700">
            <SproutIcon className="size-7" />
            <span className="hidden text-lg font-extrabold tracking-tight sm:inline">Growth Together</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {items.map(({ to, label, icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                <NavIcon icon={icon} badge={badgeFor(to)} className="size-5" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="max-w-40 truncate text-sm font-bold">{me.displayName}</div>
              <div className="text-xs text-slate-500">{ROLE_LABELS[me.role]}</div>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600"
              title="Keluar"
              aria-label="Keluar"
            >
              <LogoutIcon className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      {/* Navigasi bawah untuk HP, karena kebanyakan orang tua membuka dari HP */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid h-16 border-t border-slate-200 bg-white md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navClass}>
            <NavIcon icon={icon} badge={badgeFor(to)} className="size-6" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
