import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { BookOpen, Cake, CalendarDays, GraduationCap, IdCard, Play, Smile, Star } from 'lucide-react'
import { Alert, Card, Spinner } from '../ui.jsx'
import { IconBadge } from '../Icons.jsx'
import PostComposer from '../feed/PostComposer.jsx'
import MediaViewer from '../feed/MediaViewer.jsx'
import { showNickname } from '../../lib/format.js'
import StudentHeader, { ClassJourney } from './StudentHeader.jsx'
import { StudentGallery, StudentTimeline } from './StudentTimeline.jsx'

const TABS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'gallery', label: 'Galeri' },
]

// Tata letak seperti profil Facebook: di laptop, kartu "Tentang" dan foto di kiri, timeline di kanan.
export default function StudentProfile({ studentId, isOwnChild = false }) {
  const [tab, setTab] = useState('timeline')
  const [classroomId, setClassroomId] = useState(null)

  const profile = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => api.get(`/students/${studentId}`).then((r) => r.data),
  })

  if (profile.isPending) return <Spinner />
  if (profile.isError) return <Alert>{getErrorMessage(profile.error)}</Alert>

  const { history } = profile.data

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <StudentHeader profile={profile.data} isOwnChild={isOwnChild} />

      {history.length > 0 && <ClassJourney history={history} selected={classroomId} onSelect={setClassroomId} />}

      <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-4">
        <div className="hidden space-y-4 lg:sticky lg:top-[4.5rem] lg:block">
          <AboutCard profile={profile.data} />
          <PhotosCard studentId={studentId} onSeeAll={() => setTab('gallery')} />
        </div>

        <div className="space-y-4">
          <div role="tablist" className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
                  tab === t.id ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'timeline' ? (
            <>
              {isOwnChild && profile.data.canPost && <PostComposer />}
              <StudentTimeline studentId={studentId} classroomId={classroomId} history={history} />
            </>
          ) : (
            <StudentGallery studentId={studentId} classroomId={classroomId} />
          )}
        </div>
      </div>
    </div>
  )
}

function AboutCard({ profile }) {
  const { student, history } = profile
  const current = history.findLast((h) => h.status === 'active') ?? history.at(-1)
  const moments = history.reduce((sum, h) => sum + h.postCount, 0)
  const birth = student.birthDate
    ? new Date(`${student.birthDate}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const nickname = showNickname(student)
  const rows = [
    nickname && [Smile, `Dipanggil ${nickname}`, 'Nama panggilan'],
    student.status === 'graduated'
      ? [GraduationCap, 'Alumni', 'Sudah lulus']
      : current && [BookOpen, current.label, `Tahun ajaran ${current.academicYear}`],
    [CalendarDays, `Masuk tahun ${student.entryYear}`, `${history.length} kelas dilalui`],
    [Star, `${moments} momen tercatat`, 'Di semua kelas'],
    birth && [Cake, birth, 'Tanggal lahir'],
    [IdCard, `NIS ${student.nis}`, null],
  ].filter(Boolean)

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-bold">Tentang</h2>
      <ul className="space-y-3">
        {rows.map(([icon, title, hint]) => (
          <li key={title} className="flex items-center gap-3">
            <IconBadge icon={icon} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{title}</span>
              {hint && <span className="block text-xs text-slate-500">{hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// Pratinjau 9 foto/video terbaru, seperti kotak "Foto" di profil Facebook.
function PhotosCard({ studentId, onSeeAll }) {
  const [openIndex, setOpenIndex] = useState(null)
  const media = useQuery({
    queryKey: ['gallery', studentId, 'preview'],
    queryFn: () => api.get(`/students/${studentId}/media`).then((r) => r.data.items.slice(0, 9)),
  })
  const items = media.data ?? []

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Foto & video</h2>
        {items.length > 0 && (
          <button onClick={onSeeAll} className="rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50">
            Lihat semua
          </button>
        )}
      </div>
      {media.isPending ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada foto atau video.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-lg">
          {items.map((m, i) => (
            <button key={m.id} onClick={() => setOpenIndex(i)} className="relative aspect-square bg-slate-200" aria-label="Lihat media">
              <img src={m.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
              {m.type === 'video' && (
                <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-brand-600/90 text-white">
                  <Play className="ml-px size-3 fill-white" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {openIndex !== null && (
        <MediaViewer media={items} index={openIndex} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </Card>
  )
}
