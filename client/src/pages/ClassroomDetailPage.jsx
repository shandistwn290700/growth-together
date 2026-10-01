import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { getErrorMessage } from '../lib/api.js'
import { useMe } from '../lib/auth.js'
import { ENROLLMENT_STATUS, classLabel, useAcademicYears, useClassrooms, useTeachers } from '../lib/queries.js'
import { Alert, Avatar, Badge, Button, Card, Select, Spinner } from '../components/ui.jsx'
import { TeacherPicker } from './ClassroomsPage.jsx'

export default function ClassroomDetailPage() {
  const { id } = useParams()
  const { data: me } = useMe()
  const isAdmin = me.role === 'admin'

  const classroom = useQuery({
    queryKey: ['classroom', id],
    queryFn: () => api.get(`/classrooms/${id}`).then((res) => res.data),
  })

  if (classroom.isPending) return <Spinner />
  if (classroom.isError) return <Alert>{getErrorMessage(classroom.error)}</Alert>

  const data = classroom.data
  const activeStudents = data.students.filter((s) => s.enrollmentStatus === 'active')

  return (
    <div className="space-y-4">
      <Link to="/kelas" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Kembali ke daftar kelas
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {/* Tanda hubung tak terputus: "Ash-Shiddiq" tidak terpotong di akhir baris */}
            <h1 className="text-2xl font-extrabold text-balance text-brand-700">{classLabel(data).replace(/-/g, '‑')}</h1>
            <p className="text-sm text-slate-600">Tahun ajaran {data.AcademicYear.name}</p>
          </div>
          <Badge variant="green">{data.students.length} siswa</Badge>
        </div>
        <p className="mt-3 text-sm">
          <span className="font-semibold">Wali kelas:</span> {data.teachers.map((t) => t.fullName).join(', ') || '—'}
        </p>
        {isAdmin && <EditTeachers classroom={data} />}
      </Card>

      <StudentTable classroom={data} isAdmin={isAdmin} />

      {activeStudents.length > 0 && <PromotionPanel classroom={data} students={activeStudents} />}
    </div>
  )
}

function EditTeachers({ classroom }) {
  const queryClient = useQueryClient()
  const teachers = useTeachers()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(classroom.teachers.map((t) => t.id))

  const save = useMutation({
    mutationFn: () => api.put(`/classrooms/${classroom.id}`, { teacherIds: selected }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', String(classroom.id)] })
      queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      setOpen(false)
    },
  })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-sm font-semibold text-brand-700 hover:underline">
        Ubah wali kelas
      </button>
    )
  }

  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      {save.isError && <Alert>{getErrorMessage(save.error)}</Alert>}
      <TeacherPicker
        teachers={teachers.data}
        selected={selected}
        onToggle={(id) => setSelected(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id])}
      />
      <div className="flex gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Simpan
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Batal
        </Button>
      </div>
    </div>
  )
}

function StudentTable({ classroom, isAdmin }) {
  const [resetResult, setResetResult] = useState(null)
  const reset = useMutation({
    mutationFn: (userId) => api.post(`/admin/users/${userId}/reset-password`).then((res) => res.data),
    onSuccess: setResetResult,
  })

  const confirmReset = (student) => {
    const ok = window.confirm(
      `Reset password akun orang tua ${student.fullName}?\n\nRiwayat chat terenkripsi akun ini tidak bisa dibuka lagi setelah reset.`,
    )
    if (ok) reset.mutate(student.parentAccount.id)
  }

  return (
    <Card padding="p-0" className="overflow-hidden">
      <h2 className="px-4 pt-4 font-bold sm:px-5 sm:pt-5">Daftar siswa</h2>
      <div className="space-y-2 px-4 pt-3 sm:px-5">
        {reset.isError && <Alert>{getErrorMessage(reset.error)}</Alert>}
        {resetResult && (
          <Alert variant="success">
            Password baru untuk <b>{resetResult.username}</b>: <code className="font-mono font-bold">{resetResult.password}</code>
            <br />
            Catat sekarang, password ini tidak akan ditampilkan lagi.
          </Alert>
        )}
      </div>
      {classroom.students.length === 0 ? (
        <p className="p-5 text-sm text-slate-600">Belum ada siswa di kelas ini.</p>
      ) : (
        <>
        {/* HP: daftar kartu (tabel 4-5 kolom terlalu sempit di layar kecil) */}
        <ul className="mt-2 divide-y divide-slate-100 sm:hidden">
          {classroom.students.map((s) => {
            const status = ENROLLMENT_STATUS[s.enrollmentStatus]
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={s.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link to={`/siswa/${s.id}`} className="block truncate font-semibold text-brand-700">
                    {s.fullName}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <span>NIS {s.nis}</span>
                    {s.parentAccount?.mustChangePassword && <span className="text-amber-700">ortu belum login</span>}
                  </div>
                </div>
                {isAdmin && s.parentAccount && (
                  <button
                    onClick={() => confirmReset(s)}
                    disabled={reset.isPending}
                    aria-label={`Reset password orang tua ${s.fullName}`}
                    className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 active:bg-slate-200"
                  >
                    🔑 Reset
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <div className="mt-3 hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-2">Nama</th>
                <th className="px-3 py-2">NIS</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Akun orang tua</th>
                {isAdmin && <th className="px-5 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classroom.students.map((s) => {
                const status = ENROLLMENT_STATUS[s.enrollmentStatus]
                return (
                  <tr key={s.id}>
                    <td className="px-5 py-2 font-semibold">
                      <Link to={`/siswa/${s.id}`} className="text-brand-700 hover:underline">
                        {s.fullName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{s.nis}</td>
                    <td className="px-3 py-2">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {s.parentAccount ? (
                        <>
                          {s.parentAccount.username}
                          {s.parentAccount.mustChangePassword && <span className="ml-1 text-xs text-amber-700">(belum login)</span>}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-2 text-right">
                        {s.parentAccount && (
                          <button
                            onClick={() => confirmReset(s)}
                            disabled={reset.isPending}
                            className="text-xs font-semibold text-slate-500 hover:text-red-600"
                          >
                            Reset password
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </Card>
  )
}

const ACTION_LABELS = { promote: 'Naik kelas', retain: 'Tinggal kelas', graduate: 'Lulus', moved: 'Pindah sekolah' }

function PromotionPanel({ classroom, students }) {
  const queryClient = useQueryClient()
  const years = useAcademicYears()
  const isFinalGrade = classroom.grade === 6

  // Tahun ajaran tujuan: setelah tahun ajaran kelas ini, yang paling dekat lebih dulu.
  const targetYears = (years.data ?? [])
    .filter((y) => y.startDate > classroom.AcademicYear.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const [chosenYearId, setChosenYearId] = useState('')
  const targetYearId = chosenYearId || targetYears[0]?.id
  const targetClasses = useClassrooms(targetYearId, { enabled: Boolean(targetYearId) })

  // Pilihan per siswa yang diubah oleh guru. Siswa yang belum diubah memakai pilihan default.
  const [overrides, setOverrides] = useState({})
  const [result, setResult] = useState(null)

  const classesForGrade = (grade) => (targetClasses.data ?? []).filter((c) => c.grade === grade)
  const defaultTarget = (grade) => {
    const options = classesForGrade(grade)
    return (options.find((c) => c.name.toLowerCase() === classroom.name.toLowerCase()) ?? options[0])?.id ?? ''
  }
  const decisionFor = (studentId) =>
    overrides[studentId] ??
    (isFinalGrade
      ? { action: 'graduate', targetClassroomId: '' }
      : { action: 'promote', targetClassroomId: defaultTarget(classroom.grade + 1) })

  const setDecision = (studentId, patch) => {
    const current = decisionFor(studentId)
    const next = { ...current, ...patch }
    if (patch.action) {
      const grade = patch.action === 'promote' ? classroom.grade + 1 : classroom.grade
      next.targetClassroomId = ['promote', 'retain'].includes(patch.action) ? defaultTarget(grade) : ''
    }
    setOverrides({ ...overrides, [studentId]: next })
  }

  const setAllPromotedTo = (targetClassroomId) => {
    const next = { ...overrides }
    students.forEach((s) => {
      if (decisionFor(s.id).action === 'promote') next[s.id] = { action: 'promote', targetClassroomId: Number(targetClassroomId) }
    })
    setOverrides(next)
  }

  const submit = useMutation({
    mutationFn: (body) => api.post(`/classrooms/${classroom.id}/promotion`, body).then((res) => res.data),
    onSuccess: (data) => {
      setResult(data)
      setOverrides({})
      queryClient.invalidateQueries({ queryKey: ['classroom'] })
      queryClient.invalidateQueries({ queryKey: ['classrooms'] })
    },
  })

  const decisions = students.map((s) => ({ studentId: s.id, ...decisionFor(s.id) }))
  const missingTarget = decisions.some((d) => ['promote', 'retain'].includes(d.action) && !d.targetClassroomId)
  const needsTargetYear = decisions.some((d) => ['promote', 'retain'].includes(d.action))

  const handleSubmit = () => {
    const counts = Object.entries(ACTION_LABELS)
      .map(([action, label]) => [label, decisions.filter((d) => d.action === action).length])
      .filter(([, n]) => n > 0)
      .map(([label, n]) => `${label}: ${n} siswa`)
      .join('\n')
    if (window.confirm(`Proses kenaikan ${classLabel(classroom)}?\n\n${counts}\n\nProses ini tidak bisa dibatalkan.`)) {
      submit.mutate({ targetAcademicYearId: targetYearId, decisions })
    }
  }

  if (years.isPending) return <Spinner />

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-bold">Proses kenaikan kelas</h2>
        <p className="text-sm text-slate-600">
          {isFinalGrade
            ? 'Siswa kelas 6 yang lulus akan tetap bisa melihat arsip timeline-nya.'
            : 'Riwayat dan postingan di kelas ini tetap tersimpan setelah siswa naik kelas.'}
        </p>
      </div>

      {result && (
        <Alert variant="success">
          {result.message}. Naik: {result.summary.promote}, tinggal: {result.summary.retain}, lulus: {result.summary.graduate},
          pindah: {result.summary.moved}.
        </Alert>
      )}
      {submit.isError && <Alert>{getErrorMessage(submit.error)}</Alert>}

      {needsTargetYear && targetYears.length === 0 ? (
        <Alert variant="warning">
          Belum ada tahun ajaran berikutnya. Admin perlu membuat tahun ajaran dan kelas tujuannya terlebih dahulu.
        </Alert>
      ) : (
        <>
          {needsTargetYear && (
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Tahun ajaran tujuan</span>
                <Select value={targetYearId ?? ''} onChange={(e) => setChosenYearId(Number(e.target.value))}>
                  {targetYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </Select>
              </label>
              {!isFinalGrade && classesForGrade(classroom.grade + 1).length > 0 && (
                <label className="text-sm">
                  <span className="mb-1 block font-semibold">Pindahkan semua yang naik ke</span>
                  <Select defaultValue="" onChange={(e) => e.target.value && setAllPromotedTo(e.target.value)}>
                    <option value="">— pilih kelas —</option>
                    {classesForGrade(classroom.grade + 1).map((c) => (
                      <option key={c.id} value={c.id}>
                        {classLabel(c)}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
            </div>
          )}

          {needsTargetYear && targetClasses.isSuccess && targetClasses.data.length === 0 && (
            <Alert variant="warning">Belum ada kelas di tahun ajaran tujuan. Minta admin membuat kelasnya dulu.</Alert>
          )}

          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {students.map((s) => {
              const d = decisionFor(s.id)
              const actions = isFinalGrade ? ['graduate', 'retain', 'moved'] : ['promote', 'retain', 'moved']
              const targetGrade = d.action === 'promote' ? classroom.grade + 1 : classroom.grade
              return (
                <li key={s.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_10rem_12rem] sm:items-center">
                  <span className="font-semibold">{s.fullName}</span>
                  <Select value={d.action} onChange={(e) => setDecision(s.id, { action: e.target.value })}>
                    {actions.map((a) => (
                      <option key={a} value={a}>
                        {ACTION_LABELS[a]}
                      </option>
                    ))}
                  </Select>
                  {['promote', 'retain'].includes(d.action) ? (
                    <Select
                      value={d.targetClassroomId}
                      onChange={(e) => setDecision(s.id, { targetClassroomId: Number(e.target.value) })}
                    >
                      <option value="">— kelas tujuan —</option>
                      {classesForGrade(targetGrade).map((c) => (
                        <option key={c.id} value={c.id}>
                          {classLabel(c)}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                </li>
              )
            })}
          </ul>

          {missingTarget && <p className="text-sm text-amber-700">Lengkapi kelas tujuan untuk semua siswa yang naik/tinggal kelas.</p>}
          <Button onClick={handleSubmit} disabled={missingTarget || submit.isPending}>
            {submit.isPending ? 'Memproses…' : 'Proses kenaikan kelas'}
          </Button>
        </>
      )}
    </Card>
  )
}
