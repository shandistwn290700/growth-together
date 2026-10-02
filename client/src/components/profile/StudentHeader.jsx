import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api.js'
import { ENROLLMENT_STATUS } from '../../lib/queries.js'
import { showNickname } from '../../lib/format.js'
import { BookOpen, Cake, CalendarDays, ChevronRight, GraduationCap, IdCard, KeyRound } from 'lucide-react'
import { Badge } from '../ui.jsx'
import PhotoUploader from './PhotoUploader.jsx'

function statusBadge(student, history) {
  const withIcon = (Icon, text) => (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5" strokeWidth={2.4} />
      {text}
    </span>
  )
  if (student.status === 'graduated') return <Badge variant="green">{withIcon(GraduationCap, 'Alumni')}</Badge>
  if (student.status === 'inactive') return <Badge>Pindah sekolah</Badge>
  const current = history.findLast((h) => h.status === 'active') ?? history.at(-1)
  return current ? <Badge variant="green">{withIcon(BookOpen, current.label)}</Badge> : null
}

const formatDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

export default function StudentHeader({ profile, isOwnChild }) {
  const queryClient = useQueryClient()
  const { student, history, canEditPhoto } = profile
  const nickname = showNickname(student)
  const badge = statusBadge(student, history)
  const facts = [
    [IdCard, `NIS ${student.nis}`],
    [CalendarDays, `Masuk ${student.entryYear}`],
    student.birthDate && [Cake, formatDate(student.birthDate)],
  ].filter(Boolean)

  const savePhoto = async (uploaded) => {
    await api.put(`/students/${student.id}/photo`, uploaded)
    queryClient.invalidateQueries({ queryKey: ['student', student.id] })
    queryClient.invalidateQueries({ queryKey: ['me'] })
    queryClient.invalidateQueries({ queryKey: ['posts'] }) // avatar penulis di postingan
  }

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="h-28 bg-gradient-to-r from-brand-700 via-brand-600 to-brand-400 sm:h-40" />
      <div className="flex flex-col items-center gap-3 px-4 pb-4 sm:flex-row sm:items-end sm:gap-4 sm:px-5 sm:pb-5">
        <div className="-mt-16 sm:-mt-20">
          <PhotoUploader name={student.fullName} photoUrl={student.photoUrl} canEdit={canEditPhoto} save={savePhoto} />
        </div>

        <div className="min-w-0 flex-1 text-center sm:pb-1 sm:text-left">
          {/* Nama lengkap tebal, nama panggilan di sebelahnya lebih tipis (seperti profil Facebook) */}
          {/* Tanda hubung tak terputus (U+2011): "Al-Fatih" tidak terpotong menjadi "Al-" / "Fatih" */}
          <h1 className="text-2xl leading-tight font-extrabold text-balance break-words sm:text-3xl">
            {student.fullName.replace(/-/g, '‑')}
            {nickname && <span className="ml-2 text-xl font-semibold whitespace-nowrap text-slate-500 sm:text-2xl">({nickname})</span>}
          </h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm text-slate-600 sm:justify-start sm:gap-x-2">
            {badge}
            {facts.map(([Icon, text], i) => (
              <span key={text} className="flex items-center gap-2 whitespace-nowrap">
                {/* Titik pemisah hanya di layar lebar; di HP baris bisa turun dan titiknya akan menggantung */}
                {(badge || i > 0) && (
                  <span className="hidden text-slate-300 sm:inline" aria-hidden>
                    ·
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Icon className="size-4 text-brand-600" strokeWidth={2.2} aria-hidden />
                  {text}
                </span>
              </span>
            ))}
          </div>
        </div>

        {isOwnChild && (
          <Link
            to="/ganti-password"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 sm:mb-1"
          >
            <KeyRound className="size-4 text-brand-600" strokeWidth={2.2} /> Ganti password
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
            {i > 0 && <ChevronRight className="size-4 shrink-0 text-brand-300" strokeWidth={2.6} aria-hidden />}
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
