import { Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router'
import { KeyRound, Palette } from 'lucide-react'
import {
  HomeIcon,
  ChatIcon,
  UserIcon,
  SproutIcon,
  ClassIcon,
  ShieldIcon,
  LogoutIcon,
  IconBadge,
} from '../components/Icons.jsx'
import { ROLE_LABELS, useAuthActions, useMe } from '../lib/auth.js'
import { Avatar, Spinner } from '../components/ui.jsx'
import AuthSplash from '../components/AuthSplash.jsx'
import { motionDelay } from '../lib/motion.js'
import { ChatProvider } from '../components/chat/ChatProvider.jsx'
import ChatDock from '../components/chat/ChatDock.jsx'
import ConversationList from '../components/chat/ConversationList.jsx'
import { LocalKeyContext, openConversation, useChat, useUnreadCount } from '../components/chat/chatState.js'

// Tab di tengah bilah atas (laptop) dan menu bawah (HP). Chat hanya untuk guru ↔ orang tua.
const NAV_ITEMS = [
  { to: '/', label: 'Beranda', icon: HomeIcon, end: true, roles: ['admin', 'teacher', 'parent'] },
  { to: '/profil', label: 'Profil', icon: UserIcon, roles: ['admin', 'teacher', 'parent'] },
  { to: '/kelas', label: 'Kelas', icon: ClassIcon, roles: ['admin', 'teacher'] },
  { to: '/chat', label: 'Chat', icon: ChatIcon, roles: ['teacher', 'parent'], mobileOnly: true },
  { to: '/admin', label: 'Admin', icon: ShieldIcon, roles: ['admin'] },
]

function Badge({ count }) {
  if (!count) return null
  return (
    <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
      {count > 99 ? '99+' : count}
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
  const { pathname } = useLocation()
  const { data: unread = 0 } = useUnreadCount()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(me.role))
  const canChat = me.role !== 'admin'
  const { logout } = useAuthActions()
  const [farewell, setFarewell] = useState(false)

  // Logout: tampilkan layar perpisahan sebentar, lalu hapus sesi dan kembali ke halaman login.
  const startLogout = () => {
    setFarewell(true)
    setTimeout(logout, motionDelay(800))
  }
  // Beranda memakai tata letak 3 kolom yang lebar; halaman lain di tengah.
  const wide = pathname === '/'
  // Setiap pindah halaman: animasi masuk dan gulir ke atas. Berpindah antar-percakapan di
  // halaman Chat tidak dihitung pindah halaman, agar daftar percakapan tidak ikut berkedip.
  const pageKey = pathname.startsWith('/chat') ? '/chat' : pathname
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pageKey])
  // HP: saat membuka satu percakapan, chat memenuhi layar dan menu bawah disembunyikan (seperti WhatsApp).
  const inThread = /^\/chat\/\d+/.test(pathname)

  return (
    <div className={`min-h-dvh md:pb-0 ${inThread ? '' : 'pb-[var(--bottom-nav)]'}`}>
      <header className="sticky top-0 z-30 bg-white pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2 text-brand-700 lg:w-[280px]">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white sm:size-10">
              <SproutIcon className="size-5 sm:size-6" />
            </span>
            <span className="truncate text-lg font-extrabold tracking-tight sm:text-xl">Growth Together</span>
          </Link>

          {/* Tab tengah ala Facebook: ikon saja, garis bawah untuk tab yang aktif */}
          <nav className="hidden h-full flex-1 justify-center md:flex" aria-label="Menu utama">
            {items
              .filter((item) => !item.mobileOnly)
              .map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  title={label}
                  aria-label={label}
                  className={({ isActive }) =>
                    `relative flex h-full w-24 items-center justify-center border-b-[3px] transition-colors lg:w-28 ${
                      isActive
                        ? 'border-brand-600 text-brand-600'
                        : 'border-transparent text-slate-500 hover:rounded-lg hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="size-7" />
                </NavLink>
              ))}
          </nav>

          <div className="flex items-center justify-end gap-2 lg:w-[280px]">
            {canChat && <ChatMenu unread={unread} />}
            <AccountMenu me={me} onLogout={startLogout} />
          </div>
        </div>
      </header>

      <main
        className={`mx-auto md:px-4 md:py-6 ${inThread ? '' : 'px-3 py-3 sm:px-4 sm:py-4'} ${wide ? 'max-w-[1400px]' : 'max-w-5xl'}`}
      >
        <div key={pageKey} className="animate-page-in">
          {/* Header dan menu tetap tampil saat halaman berikutnya sedang diunduh */}
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Navigasi bawah untuk HP, karena kebanyakan orang tua membuka dari HP */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-30 h-[var(--bottom-nav)] border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden ${
          inThread ? 'hidden' : 'grid'
        }`}
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        aria-label="Menu utama"
      >
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                isActive ? 'text-brand-700' : 'text-slate-500'
              }`
            }
          >
            <span className="relative">
              <Icon className="size-6" />
              {to === '/chat' && <Badge count={unread} />}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>

      {canChat && <ChatDock />}
      {farewell && <AuthSplash title={`Sampai jumpa, ${me.displayName}`} subtitle="Semoga harimu menyenangkan" />}
    </div>
  )
}

// Tutup popup saat klik di luar atau menekan Escape.
function useDismiss(open, setOpen) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])
  return ref
}

// Tombol chat di bilah atas: membuka daftar percakapan. Memilih percakapan membuka jendela mini.
function ChatMenu({ unread }) {
  const { dock, localKey } = useChat()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, setOpen)

  const select = (conversationId) => {
    setOpen(false)
    openConversation(conversationId, { dock, navigate })
  }

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen(!open)}
        title="Chat"
        aria-label={`Chat${unread ? `, ${unread} pesan belum dibaca` : ''}`}
        aria-expanded={open}
        className={`relative flex size-10 items-center justify-center rounded-full ${
          open ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        <ChatIcon className="size-5" />
        <Badge count={unread} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 flex h-[min(560px,calc(100dvh-5rem))] w-[360px] origin-top-right animate-menu-in flex-col overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200">
          <LocalKeyContext.Provider value={localKey}>
            <ConversationList onSelect={select} />
          </LocalKeyContext.Provider>
          <Link
            to="/chat"
            onClick={() => setOpen(false)}
            className="border-t border-slate-100 p-3 text-center text-sm font-semibold text-brand-700 hover:bg-slate-50"
          >
            Lihat semua di halaman Chat
          </Link>
        </div>
      )}
    </div>
  )
}

// Avatar di pojok kanan atas dengan menu: lihat profil, ganti password, keluar.
function AccountMenu({ me, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, setOpen)

  const item = 'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-slate-100'

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
        <div role="menu" className="absolute right-0 z-40 mt-2 w-72 origin-top-right animate-menu-in rounded-xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
          <Link to="/profil" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg p-2 shadow-sm ring-1 ring-slate-100 hover:bg-slate-50">
            <Avatar name={me.displayName} src={me.avatarUrl} />
            <div className="min-w-0">
              <div className="truncate font-bold">{me.displayName}</div>
              <div className="text-xs text-slate-500">{ROLE_LABELS[me.role]} · lihat profil</div>
            </div>
          </Link>
          <div className="mt-2 space-y-0.5">
            <Link to="/ganti-password" onClick={() => setOpen(false)} className={item} role="menuitem">
              <IconBadge icon={KeyRound} />
              Ganti password
            </Link>
            {me.role === 'admin' && (
              <Link to="/admin#tema" onClick={() => setOpen(false)} className={item} role="menuitem">
                <IconBadge icon={Palette} />
                Tema warna
              </Link>
            )}
            <button
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className={item}
              role="menuitem"
            >
              <IconBadge icon={LogoutIcon} />
              Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
