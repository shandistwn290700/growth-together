import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api, { getErrorMessage } from '../lib/api.js'
import { useMe } from '../lib/auth.js'
import { notify } from '../lib/alert.js'
import { classLabel, useAcademicYears, useClassroomBase, useClassrooms, useTeachers } from '../lib/queries.js'
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../components/ui.jsx'

export default function ClassroomsPage() {
  const { data: me } = useMe()
  const isAdmin = me.role === 'admin'
  const base = useClassroomBase()
  const years = useAcademicYears()
  const [selectedYearId, setSelectedYearId] = useState('')

  const activeYear = years.data?.find((y) => y.isActive)
  const yearId = selectedYearId || activeYear?.id || years.data?.[0]?.id
  const classrooms = useClassrooms(yearId, { enabled: Boolean(yearId) })

  if (years.isPending) return <Spinner />
  if (years.isError) return <Alert>{getErrorMessage(years.error)}</Alert>
  if (!years.data.length) {
    return (
      <Card>
        <h1 className="text-xl font-bold">Kelas</h1>
        <p className="mt-1 text-slate-600">
          Belum ada tahun ajaran.{' '}
          {isAdmin ? (
            <Link to="/admin/tahun-ajaran" className="font-semibold text-brand-700 underline">
              Buat tahun ajaran terlebih dahulu
            </Link>
          ) : (
            'Hubungi admin sekolah.'
          )}
        </p>
      </Card>
    )
  }

  // Guru hanya melihat kelas yang ia ampu.
  const list = (classrooms.data ?? []).filter((c) => isAdmin || c.teachers.some((t) => t.id === me.id))
  const byGrade = list.reduce((groups, c) => ({ ...groups, [c.grade]: [...(groups[c.grade] ?? []), c] }), {})

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{isAdmin ? 'Semua Kelas' : 'Kelas Saya'}</h1>
          <p className="text-sm text-slate-600">Pilih kelas untuk melihat siswa dan memproses kenaikan kelas.</p>
        </div>
        <div className="w-48">
          <Field label="Tahun ajaran">
            <Select value={yearId ?? ''} onChange={(e) => setSelectedYearId(Number(e.target.value))}>
              {years.data.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isActive ? '(aktif)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {isAdmin && yearId && <CreateClassroomForm academicYearId={yearId} />}

      {classrooms.isPending ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Card>
          <p className="text-slate-600">
            {isAdmin ? 'Belum ada kelas di tahun ajaran ini.' : 'Anda belum terdaftar sebagai wali kelas di tahun ajaran ini.'}
          </p>
        </Card>
      ) : (
        Object.entries(byGrade).map(([grade, items]) => (
          <section key={grade}>
            <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">Kelas {grade}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c) => (
                <Link
                  key={c.id}
                  to={`${base}/${c.id}`}
                  className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md hover:ring-2 hover:ring-brand-100"
                >
                  <div className="text-lg font-bold text-brand-700">{classLabel(c)}</div>
                  <div className="mt-1 text-sm text-slate-600">{c.studentCount} siswa</div>
                  <div className="mt-2 truncate text-xs text-slate-500">
                    Wali kelas: {c.teachers.map((t) => t.fullName).join(', ') || '—'}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function CreateClassroomForm({ academicYearId }) {
  const queryClient = useQueryClient()
  const teachers = useTeachers()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ grade: '1', name: '', teacherIds: [] })

  const create = useMutation({
    mutationFn: (body) => api.post('/classrooms', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      setForm({ grade: form.grade, name: '', teacherIds: [] })
      setOpen(false)
      notify('Kelas ditambahkan')
    },
  })

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + Tambah kelas
      </Button>
    )
  }

  const toggleTeacher = (id) =>
    setForm({
      ...form,
      teacherIds: form.teacherIds.includes(id) ? form.teacherIds.filter((t) => t !== id) : [...form.teacherIds, id],
    })

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate({ academicYearId, grade: Number(form.grade), name: form.name, teacherIds: form.teacherIds })
        }}
      >
        <h2 className="font-bold">Tambah kelas</h2>
        {create.isError && <Alert>{getErrorMessage(create.error)}</Alert>}
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <Field label="Tingkat">
            <Select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
              {[1, 2, 3, 4, 5, 6].map((g) => (
                <option key={g} value={g}>
                  Kelas {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nama kelas">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Abu Bakar" required />
          </Field>
        </div>
        <TeacherPicker teachers={teachers.data} selected={form.teacherIds} onToggle={toggleTeacher} />
        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending}>
            Simpan
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Batal
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function TeacherPicker({ teachers, selected, onToggle }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-slate-700">Wali kelas</legend>
      {!teachers?.length ? (
        <p className="text-sm text-slate-500">Belum ada akun guru. Import guru lewat halaman Admin.</p>
      ) : (
        <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
          {teachers.map((t) => (
            <label key={t.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={selected.includes(t.id)} onChange={() => onToggle(t.id)} className="accent-brand-700" />
              {t.fullName}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}
