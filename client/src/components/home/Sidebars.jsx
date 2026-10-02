import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  FileSpreadsheet,
  GraduationCap,
  House,
  MessageCircle,
  Palette,
  Shield,
  Sprout,
  TrendingUp,
  User,
} from 'lucide-react'
import { IconBadge } from '../Icons.jsx'
import api from '../../lib/api.js'
import { useMe } from '../../lib/auth.js'
import { classLabel, useAcademicYears, useClassrooms, useTeachers } from '../../lib/queries.js'
import { Avatar } from '../ui.jsx'
import { OnlineAvatar } from '../chat/ConversationList.jsx'
import { counterpartName, useChatContacts, useOpenChat, useUnreadCount } from '../chat/chatState.js'

// Sidebar menempel saat feed digulir, dan bisa digulir sendiri jika isinya panjang.
const STICKY = 'sticky top-[4.5rem] max-h-[calc(100dvh-5.5rem)] overflow-y-auto pb-4 [scrollbar-width:thin]'

function SidebarLink({ to, icon, label, hint, badge }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-200/70">
      <IconBadge icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{label}</span>
        {hint && <span className="block truncate text-xs text-slate-500">{hint}</span>}
      </span>
      {badge > 0 && <span className="rounded-full bg-red-500 px-2 text-xs font-bold text-white">{badge}</span>}
    </Link>
  )
}

function SectionTitle({ children }) {
  return <h2 className="px-2 pt-4 pb-1 text-sm font-bold text-slate-500">{children}</h2>
}

// ---------- Kiri: pintasan ----------

export function LeftSidebar() {
  const { data: me } = useMe()
  const { data: unread = 0 } = useUnreadCount()
  const isParent = me.role === 'parent'

  return (
    <aside className={STICKY} aria-label="Pintasan">
      <Link to="/profil" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-200/70">
        <Avatar name={me.displayName} src={me.avatarUrl} size="sm" />
        <span className="truncate font-bold">{me.displayName}</span>
      </Link>
      <SidebarLink to="/" icon={House} label="Beranda" />
      <SidebarLink
        to="/profil"
        icon={isParent ? Sprout : User}
        label={isParent ? 'Timeline ananda' : 'Profil saya'}
        hint={isParent ? 'Perjalanan kelas & galeri' : undefined}
      />
      {me.role !== 'admin' && <SidebarLink to="/chat" icon={MessageCircle} label="Chat" hint="Terenkripsi end-to-end" badge={unread} />}
      {me.role !== 'parent' && <SidebarLink to="/kelas" icon={GraduationCap} label={me.role === 'admin' ? 'Semua kelas' : 'Kelas'} />}
      {me.role === 'admin' && <SidebarLink to="/admin" icon={Shield} label="Admin" hint="Tahun ajaran, import akun, tema" />}

      {me.role === 'teacher' && <TeacherClasses me={me} />}
      {isParent && <ChildClass me={me} />}

      <p className="px-2 pt-6 text-xs text-slate-400">Growth Together · Bersama mendampingi tumbuh kembang ananda</p>
    </aside>
  )
}

function TeacherClasses({ me }) {
  const classrooms = useClassrooms()
  const mine = (classrooms.data ?? []).filter((c) => c.teachers.some((t) => t.id === me.id))
  if (mine.length === 0) return null
  return (
    <>
      <SectionTitle>Kelas saya</SectionTitle>
      {mine.map((c) => (
        <SidebarLink key={c.id} to={`/kelas/${c.id}`} icon={BookOpen} label={classLabel(c)} hint={`${c.studentCount} siswa`} />
      ))}
    </>
  )
}

function ChildClass({ me }) {
  const profile = useQuery({
    queryKey: ['student', me.student.id],
    queryFn: () => api.get(`/students/${me.student.id}`).then((r) => r.data),
  })
  const history = profile.data?.history ?? []
  const current = history.findLast((h) => h.status === 'active') ?? history.at(-1)
  if (!current) return null
  return (
    <>
      <SectionTitle>Kelas ananda</SectionTitle>
      <SidebarLink to="/profil" icon={BookOpen} label={current.label} hint={`Tahun ajaran ${current.academicYear}`} />
    </>
  )
}

// ---------- Kanan: kontak & ringkasan ----------

export function RightSidebar() {
  const { data: me } = useMe()
  return (
    <aside className={STICKY} aria-label="Informasi">
      {me.role === 'admin' ? <AdminSummary /> : <Contacts me={me} />}
      {me.role !== 'parent' && <ActiveYear />}
    </aside>
  )
}

function Contacts({ me }) {
  const contacts = useChatContacts()
  const openChat = useOpenChat()
  const list = [...(contacts.data ?? [])].sort((a, b) => Number(b.online) - Number(a.online))

  return (
    <section>
      <SectionTitle>{me.role === 'parent' ? 'Wali kelas' : 'Orang tua siswa'}</SectionTitle>
      {contacts.isSuccess && list.length === 0 && (
        <p className="px-2 text-sm text-slate-500">Belum ada kontak di tahun ajaran aktif.</p>
      )}
      <ul>
        {list.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => openChat.mutate(c)}
              disabled={openChat.isPending}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-200/70"
              title={`Chat dengan ${counterpartName(c)}`}
            >
              <OnlineAvatar person={c} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{counterpartName(c)}</span>
                <span className="block truncate text-xs text-slate-500">{c.online ? 'Online' : c.subtitle}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ActiveYear() {
  const years = useAcademicYears()
  const active = years.data?.find((y) => y.isActive)
  if (!active) return null
  return (
    <section>
      <SectionTitle>Tahun ajaran aktif</SectionTitle>
      <div className="mx-2 rounded-xl bg-white p-3 shadow-sm">
        <div className="text-lg font-extrabold text-brand-700">{active.name}</div>
        <div className="text-xs text-slate-500">
          {new Date(active.startDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} –{' '}
          {new Date(active.endDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
        </div>
      </div>
    </section>
  )
}

function AdminSummary() {
  const classrooms = useClassrooms()
  const teachers = useTeachers()
  const students = (classrooms.data ?? []).reduce((sum, c) => sum + c.studentCount, 0)
  const stats = [
    { label: 'Kelas', value: classrooms.data?.length },
    { label: 'Siswa', value: students },
    { label: 'Guru', value: teachers.data?.filter((t) => t.isActive).length },
  ]
  return (
    <section>
      <SectionTitle>Ringkasan sekolah</SectionTitle>
      <div className="mx-2 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-3 text-center shadow-sm">
            <div className="text-xl font-extrabold text-brand-700">{s.value ?? '–'}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <SidebarLink to="/admin" icon={FileSpreadsheet} label="Import akun dari Excel" />
        <SidebarLink to="/kelas" icon={TrendingUp} label="Proses kenaikan kelas" />
        <SidebarLink to="/admin#tema" icon={Palette} label="Ganti tema warna" />
      </div>
    </section>
  )
}
