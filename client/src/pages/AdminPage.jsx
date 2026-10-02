import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, FileSpreadsheet, Palette, Sprout } from 'lucide-react'
import api, { downloadBlob, getErrorMessage } from '../lib/api.js'
import { useAcademicYears, useTeachers } from '../lib/queries.js'
import { DEFAULT_THEME, THEMES, applyTheme } from '../lib/theme.js'
import { APPEARANCE_KEY, useAppearance } from '../lib/useAppearance.js'
import { Alert, Badge, Button, Card, Field, Input, Spinner } from '../components/ui.jsx'
import { IconBadge } from '../components/Icons.jsx'

export default function AdminPage() {
  // Tautan "/admin#tema" (dari menu akun) langsung menggulir ke bagian tema warna.
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }))
    return () => cancelAnimationFrame(frame)
  }, [hash])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Admin</h1>
      <AcademicYearSection />
      <ThemeSection />
      <ImportSection />
      <TeacherSection />
    </div>
  )
}

// ---------- Tema warna ----------

function ThemeSection() {
  const queryClient = useQueryClient()
  const { data } = useAppearance()
  const current = data?.theme ?? DEFAULT_THEME

  const save = useMutation({
    mutationFn: (theme) => api.put('/admin/settings/appearance', { theme }).then((r) => r.data),
    // Langsung terlihat saat diklik; dikembalikan jika gagal disimpan.
    onMutate: (theme) => {
      const previous = current
      applyTheme(theme)
      queryClient.setQueryData(APPEARANCE_KEY, { theme })
      return { previous }
    },
    onError: (err, theme, context) => {
      applyTheme(context.previous)
      queryClient.setQueryData(APPEARANCE_KEY, { theme: context.previous })
    },
  })

  return (
    <Card className="scroll-mt-20 space-y-4" id="tema">
      <div className="flex items-start gap-3">
        <IconBadge icon={Palette} />
        <div>
          <h2 className="text-lg font-bold">Tema warna</h2>
          <p className="text-sm text-slate-600">
            Warna tombol, ikon, dan tautan untuk <b>semua pengguna</b>. Pengguna lain melihat tema baru saat membuka atau kembali ke
            aplikasi.
          </p>
        </div>
      </div>

      {save.isError && <Alert>{getErrorMessage(save.error)}</Alert>}

      <div role="radiogroup" aria-label="Pilihan tema warna" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(THEMES).map(([key, theme]) => {
          const selected = key === current
          return (
            <button
              key={key}
              role="radio"
              aria-checked={selected}
              onClick={() => !selected && save.mutate(key)}
              disabled={save.isPending}
              className={`flex items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-colors ${
                selected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Pratinjau dua warna: warna tema + putih */}
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                style={{ background: `linear-gradient(135deg, ${theme.shades[700]}, ${theme.shades[500]})` }}
              >
                <Sprout className="size-5" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold">{theme.label}</span>
              {selected && <Check className="size-5 shrink-0 text-brand-600" strokeWidth={2.6} aria-hidden />}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

// ---------- Tahun ajaran ----------

function suggestNextYear(years) {
  const latest = years?.[0] // sudah terurut dari yang terbaru
  const start = latest ? Number(latest.name.slice(0, 4)) + 1 : new Date().getFullYear()
  return { name: `${start}/${start + 1}`, startDate: `${start}-07-01`, endDate: `${start + 1}-06-30` }
}

function AcademicYearSection() {
  const queryClient = useQueryClient()
  const years = useAcademicYears()
  const [form, setForm] = useState(null)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic-years'] })
    queryClient.invalidateQueries({ queryKey: ['classrooms'] })
  }
  const create = useMutation({
    mutationFn: (body) => api.post('/academic-years', body),
    onSuccess: () => {
      refresh()
      setForm(null)
    },
  })
  const activate = useMutation({
    mutationFn: (id) => api.patch(`/academic-years/${id}/activate`),
    onSuccess: refresh,
  })

  const confirmActivate = (year) => {
    const ok = window.confirm(
      `Aktifkan tahun ajaran ${year.name}?\n\nPostingan baru akan masuk ke kelas di tahun ajaran ini. Pastikan kenaikan kelas sudah diproses.`,
    )
    if (ok) activate.mutate(year.id)
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Tahun ajaran</h2>
        {!form && (
          <Button variant="secondary" onClick={() => setForm(suggestNextYear(years.data))}>
            + Tahun ajaran baru
          </Button>
        )}
      </div>

      {(create.isError || activate.isError) && <Alert>{getErrorMessage(create.error ?? activate.error)}</Alert>}

      {form && (
        <form
          className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-4 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate(form)
          }}
        >
          <Field label="Nama">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2026/2027" required />
          </Field>
          <Field label="Mulai">
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
          </Field>
          <Field label="Selesai">
            <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              Simpan
            </Button>
            <Button type="button" variant="secondary" onClick={() => setForm(null)}>
              Batal
            </Button>
          </div>
        </form>
      )}

      {years.isPending ? (
        <Spinner />
      ) : years.data.length === 0 ? (
        <p className="text-sm text-slate-600">Belum ada tahun ajaran. Buat satu, lalu aktifkan.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {years.data.map((y) => (
            <li key={y.id} className="flex items-center justify-between py-2">
              <div>
                <span className="font-semibold">{y.name}</span>{' '}
                {y.isActive && <Badge variant="green">Aktif</Badge>}
                <div className="text-xs text-slate-500">
                  {y.startDate} s.d. {y.endDate}
                </div>
              </div>
              {!y.isActive && (
                <Button variant="secondary" onClick={() => confirmActivate(y)} disabled={activate.isPending}>
                  Aktifkan
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ---------- Import Excel ----------

function base64ToBlob(base64, type) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type })
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function ImportSection() {
  const queryClient = useQueryClient()
  const fileInput = useRef(null)
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [downloaded, setDownloaded] = useState(false)

  const template = useMutation({
    mutationFn: () => api.get('/admin/import/template', { responseType: 'blob' }).then((res) => res.data),
    onSuccess: (blob) => downloadBlob(blob, 'template-import-growth-together.xlsx'),
  })

  const upload = useMutation({
    mutationFn: (selected) => {
      const body = new FormData()
      body.append('file', selected)
      return api.post('/admin/import', body).then((res) => res.data)
    },
    onMutate: () => setResult(null),
    onSuccess: (data) => {
      setResult(data)
      setDownloaded(false)
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
  })

  const errorRows = upload.error?.response?.data?.errors

  const downloadCredentials = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadBlob(base64ToBlob(result.credentialsFile, XLSX_TYPE), `akun-growth-together-${stamp}.xlsx`)
    setDownloaded(true)
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Import akun dari Excel</h2>
        <p className="text-sm text-slate-600">
          Untuk siswa (beserta akun orang tuanya) dan guru. Siswa dimasukkan ke kelas di tahun ajaran aktif.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => template.mutate()} disabled={template.isPending}>
          Unduh template
        </Button>
      </div>

      <form
        className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-300 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (file) upload.mutate(file)
        }}
      >
        {/* Tombol pilih file sendiri (bahasa Indonesia), menggantikan "Choose File" bawaan browser */}
        <input ref={fileInput} type="file" accept=".xlsx" hidden onChange={(e) => setFile(e.target.files[0] ?? null)} />
        <button
          type="button"
          onClick={() => fileInput.current.click()}
          className="flex min-w-0 flex-1 basis-56 items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-left text-sm font-semibold text-brand-700 hover:bg-brand-100"
        >
          <FileSpreadsheet className="size-5 shrink-0" strokeWidth={2.2} aria-hidden />
          <span className="truncate">{file ? file.name : 'Pilih file Excel (.xlsx)'}</span>
        </button>
        <Button type="submit" disabled={!file || upload.isPending}>
          {upload.isPending ? 'Memproses… (bisa beberapa menit)' : 'Upload & import'}
        </Button>
      </form>

      {upload.isError && (
        <div className="space-y-2">
          <Alert>{getErrorMessage(upload.error)}</Alert>
          {errorRows && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-red-100">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-red-50 text-xs text-red-800 uppercase">
                  <tr>
                    <th className="px-3 py-1">Sheet</th>
                    <th className="px-3 py-1">Baris</th>
                    <th className="px-3 py-1">Kesalahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {errorRows.map((err, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1">{err.sheet}</td>
                      <td className="px-3 py-1">{err.row}</td>
                      <td className="px-3 py-1">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <Alert variant="success">
            Import berhasil: {result.summary.students} siswa (beserta akun orang tua), {result.summary.teachers} guru,{' '}
            {result.summary.classrooms} kelas baru.
          </Alert>
          <Alert variant="warning">
            <b>Penting:</b> unduh daftar password awal sekarang. Demi keamanan, daftar ini tidak disimpan di server dan tidak
            bisa diunduh lagi setelah halaman ditutup.
          </Alert>
          <Button onClick={downloadCredentials}>{downloaded ? 'Unduh lagi daftar password' : 'Unduh daftar password awal'}</Button>
        </div>
      )}
    </Card>
  )
}

// ---------- Guru ----------

function TeacherSection() {
  const queryClient = useQueryClient()
  const teachers = useTeachers()
  const [resetResult, setResetResult] = useState(null)

  const reset = useMutation({
    mutationFn: (id) => api.post(`/admin/users/${id}/reset-password`).then((res) => res.data),
    onSuccess: setResetResult,
  })
  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }) => api.patch(`/admin/users/${id}/status`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  })

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-bold">Guru</h2>
      {(reset.isError || toggleActive.isError) && <Alert>{getErrorMessage(reset.error ?? toggleActive.error)}</Alert>}
      {resetResult && (
        <Alert variant="success">
          Password baru untuk <b>{resetResult.username}</b>: <code className="font-mono font-bold">{resetResult.password}</code>
          <br />
          Catat sekarang, password ini tidak akan ditampilkan lagi.
        </Alert>
      )}
      {teachers.isPending ? (
        <Spinner />
      ) : teachers.data.length === 0 ? (
        <p className="text-sm text-slate-600">Belum ada guru. Tambahkan lewat import Excel.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {teachers.data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <span className="font-semibold">{t.fullName}</span>{' '}
                {!t.isActive && <Badge>Nonaktif</Badge>}
                {t.isActive && t.mustChangePassword && <Badge variant="amber">Belum login</Badge>}
                <div className="text-xs text-slate-500">{t.username}</div>
              </div>
              <div className="flex gap-3 text-xs font-semibold">
                <button
                  className="text-slate-500 hover:text-red-600"
                  disabled={reset.isPending}
                  onClick={() =>
                    window.confirm(
                      `Reset password ${t.fullName}?\n\nRiwayat chat terenkripsi akun ini tidak bisa dibuka lagi setelah reset.`,
                    ) && reset.mutate(t.id)
                  }
                >
                  Reset password
                </button>
                <button
                  className="text-slate-500 hover:text-brand-700"
                  disabled={toggleActive.isPending}
                  onClick={() => toggleActive.mutate({ id: t.id, isActive: !t.isActive })}
                >
                  {t.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
