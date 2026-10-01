import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api.js'
import { ENROLLMENT_STATUS } from '../../lib/queries.js'
import { Badge } from '../ui.jsx'
import PhotoUploader from './PhotoUploader.jsx'

function statusBadge(student, history) {
  if (student.status === 'graduated') return <Badge variant="blue">🎓 Alumni</Badge>
  if (student.status === 'inactive') return <Badge>Pindah sekolah</Badge>
  const current = history.findLast((h) => h.status === 'active') ?? history.at(-1)
  return current ? <Badge variant="green">{current.label}</Badge> : null
}

const formatDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

export default function StudentHeader({ profile, isOwnChild }) {
  const queryClient = useQueryClient()
  const { student, history, canEditPhoto } = profile

  const savePhoto = async (uploaded) => {
    await api.put(`/students/${student.id}/photo`, uploaded)
    queryClient.invalidateQueries({ queryKey: ['student', student.id] })
    queryClient.invalidateQueries({ queryKey: ['me'] })
    queryClient.invalidateQueries({ queryKey: ['posts'] }) // avatar penulis di postingan
  }

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="h-28 bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-400 sm:h-40" />
      <div className="flex flex-col items-center gap-3 px-5 pb-5 sm:flex-row sm:items-end">
        <div className="-mt-16 sm:-mt-20">
          <PhotoUploader name={student.fullName} photoUrl={student.photoUrl} canEdit={canEditPhoto} save={savePhoto} />
        </div>
        <div className="min-w-0 flex-1 text-center sm:pb-2 sm:text-left">
          <h1 className="text-2xl font-extrabold">{student.fullName}</h1>
          {student.nickname && <p className="text-slate-600">“{student.nickname}”</p>}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-slate-600 sm:justify-start">
            {statusBadge(student, history)}
            <span>NIS {student.nis}</span>
            <span>Masuk {student.entryYear}</span>
            {student.birthDate && <span>Lahir {formatDate(student.birthDate)}</span>}
          </div>
        </div>
        {isOwnChild && (
          <Link to="/ganti-password" className="text-sm font-semibold text-brand-700 hover:underline sm:pb-2">
            Ganti password
          </Link>
        )}
      </div>
    </section>
  )
}

// Perjalanan kelas: Kelas 1 → Kelas 2 → … sekaligus filter timeline.
export function ClassJourney({ history, selected, onSelect }) {
  const total = history.reduce((sum, h) => sum + h.postCount, 0)
  const chip = (active) =>
    `shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${
      active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white hover:border-brand-600'
    }`

  return (
    <nav aria-label="Perjalanan kelas" className="flex gap-2 overflow-x-auto pb-1">
      <button onClick={() => onSelect(null)} className={chip(selected === null)} aria-pressed={selected === null}>
        <div className="text-sm font-bold">Semua</div>
        <div className={`text-xs ${selected === null ? 'text-brand-100' : 'text-slate-500'}`}>{total} momen</div>
      </button>
      {history.map((h, i) => {
        const active = selected === h.classroomId
        return (
          <div key={h.classroomId} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-300" aria-hidden>→</span>}
            <button onClick={() => onSelect(h.classroomId)} className={chip(active)} aria-pressed={active}>
              <div className="text-sm font-bold whitespace-nowrap">{h.label}</div>
              <div className={`text-xs whitespace-nowrap ${active ? 'text-brand-100' : 'text-slate-500'}`}>
                {h.academicYear} · {h.postCount} momen
                {h.status !== 'active' && ` · ${ENROLLMENT_STATUS[h.status].label}`}
              </div>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
