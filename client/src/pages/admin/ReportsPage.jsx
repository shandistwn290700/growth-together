import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileArchive, FileSpreadsheet, FileText, Images, ShieldAlert } from 'lucide-react'
import api, { downloadBlob, getErrorMessage } from '../../lib/api.js'
import { useAcademicYears } from '../../lib/queries.js'
import { formatNumber } from '../../lib/format.js'
import { APPEARANCE_KEY, useAppearance } from '../../lib/useAppearance.js'
import { Alert, Button, Field, Input, Select, Spinner } from '../../components/ui.jsx'
import { IconBadge } from '../../components/Icons.jsx'
import { PageHeader, Panel } from '../../components/admin/AdminUI.jsx'

// Bulan & semester saat ini menurut kalender sekolah (Juli–Desember = ganjil).
function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
const currentHalf = () => (new Date().getMonth() >= 6 ? 'ganjil' : 'genap')

const ARCHIVE_CONTENTS = [
  [FileText, 'Ringkasan.pdf', 'Angka utama, grafik & rekap per kelas, siswa yang belum memiliki momen.'],
  [FileSpreadsheet, 'Rekap-aktivitas.xlsx', 'Sheet Ringkasan, Per kelas, Per siswa, Postingan, dan Video (dengan tautan).'],
  [Images, 'Foto/', 'Dikelompokkan per kelas; foto bersama di folder "_Kegiatan kelas".'],
]

function SchoolNameForm({ className }) {
  const queryClient = useQueryClient()
  const { data } = useAppearance()
  const [name, setName] = useState(null) // null = belum diubah, pakai nilai dari server
  const value = name ?? data?.schoolName ?? ''

  const save = useMutation({
    mutationFn: () => api.put('/admin/settings/appearance', { schoolName: value }).then((r) => r.data),
    onSuccess: (saved) => {
      queryClient.setQueryData(APPEARANCE_KEY, saved)
      setName(null)
    },
  })

  return (
    <Panel title="Kop laporan" className={className} description="Nama sekolah tampil di kop PDF dan di halaman login.">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <div className="flex-1">
          <Field label="Nama sekolah">
            <Input value={value} onChange={(e) => setName(e.target.value)} placeholder="Contoh: SDIT Bahtera Nuh" maxLength={100} />
          </Field>
        </div>
        <Button type="submit" disabled={save.isPending || name === null}>
          {save.isSuccess && name === null ? 'Tersimpan' : 'Simpan'}
        </Button>
      </form>
      {save.isError && (
        <div className="mt-2">
          <Alert>{getErrorMessage(save.error)}</Alert>
        </div>
      )}
    </Panel>
  )
}

export default function ReportsPage() {
  const years = useAcademicYears()
  const [type, setType] = useState('month')
  const [month, setMonth] = useState(currentMonth())
  const [yearId, setYearId] = useState('')
  const [half, setHalf] = useState(currentHalf())
  const [progress, setProgress] = useState(null) // MB yang sudah terunduh

  const activeYear = years.data?.find((y) => y.isActive) ?? years.data?.[0]
  const academicYearId = yearId || activeYear?.id
  const params = type === 'month' ? { type, month } : { type, academicYearId, half }
  const ready = type === 'month' ? Boolean(month) : Boolean(academicYearId)

  const preview = useQuery({
    queryKey: ['admin', 'report-preview', params],
    queryFn: () => api.get('/admin/reports/preview', { params }).then((r) => r.data),
    enabled: ready,
    placeholderData: keepPreviousData,
  })

  const download = useMutation({
    mutationFn: async () => {
      setProgress(0)
      const res = await api.get('/admin/reports/download', {
        params,
        responseType: 'blob',
        onDownloadProgress: (e) => setProgress(e.loaded / 1024 / 1024),
      })
      const name = /filename="?([^"]+)"?/.exec(res.headers['content-disposition'] ?? '')?.[1] ?? 'laporan.zip'
      downloadBlob(res.data, name)
    },
    onSettled: () => setProgress(null),
  })

  const t = preview.data?.totals
  const segment = (active) =>
    `flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${active ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`

  return (
    <>
      <PageHeader title="Laporan" description="Arsip ZIP berisi ringkasan PDF untuk pimpinan, rekap Excel, dan foto periode tersebut." />

      {/* Di HP pratinjau & tombol unduh tampil tepat setelah pilihan periode; di laptop berada di kolom kanan. */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Periode laporan" className="lg:col-start-1">
          <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto" role="tablist">
            <button role="tab" aria-selected={type === 'month'} className={segment(type === 'month')} onClick={() => setType('month')}>
              Bulanan
            </button>
            <button role="tab" aria-selected={type === 'semester'} className={segment(type === 'semester')} onClick={() => setType('semester')}>
              Semester
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {type === 'month' ? (
              <Field label="Bulan">
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} max={currentMonth()} required />
              </Field>
            ) : (
              <>
                <Field label="Tahun ajaran">
                  <Select value={academicYearId ?? ''} onChange={(e) => setYearId(e.target.value)}>
                    {(years.data ?? []).map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isActive ? '(aktif)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Semester">
                  <Select value={half} onChange={(e) => setHalf(e.target.value)}>
                    <option value="ganjil">Ganjil (Juli – Desember)</option>
                    <option value="genap">Genap (Januari – Juni)</option>
                  </Select>
                </Field>
              </>
            )}
          </div>
        </Panel>

        <Panel title="Pratinjau" className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-3 lg:row-start-1">
          {!ready || preview.isPending ? (
            <Spinner />
          ) : preview.isError ? (
            <Alert>{getErrorMessage(preview.error)}</Alert>
          ) : (
            <div className={`space-y-4 transition-opacity ${preview.isFetching ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <IconBadge icon={FileArchive} size="lg" />
                <div className="min-w-0">
                  <div className="font-bold">{preview.data.label}</div>
                  <div className="text-xs text-slate-500">Tahun ajaran {preview.data.academicYear ?? '—'}</div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Postingan', t.posts],
                  ['Foto', t.photos],
                  ['Video', t.videos],
                  ['Komentar', t.comments],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-2.5">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="text-lg font-extrabold text-slate-800">{formatNumber(value)}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-slate-600">
                Siswa dengan momen: <b>{formatNumber(t.studentsWithMoments)}</b> dari {formatNumber(t.students)}
                <br />
                Perkiraan ukuran: <b>± {preview.data.estimatedSizeMB.toLocaleString('id-ID')} MB</b>
              </p>

              {download.isError && <Alert>Laporan gagal dibuat. Coba lagi.</Alert>}
              <Button className="w-full" onClick={() => download.mutate()} disabled={download.isPending}>
                <Download className="size-4" />
                {download.isPending
                  ? progress > 0.05
                    ? `Mengunduh… ${progress.toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`
                    : 'Menyiapkan laporan…'
                  : 'Unduh ZIP'}
              </Button>
              {t.photos > 50 && !download.isPending && (
                <p className="text-xs text-slate-500">Banyak foto: pembuatan arsip bisa memakan waktu beberapa menit.</p>
              )}
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                Arsip berisi foto dan data anak-anak. Simpan di tempat aman dan jangan dibagikan sembarangan.
              </p>
            </div>
          )}
        </Panel>
        <Panel title="Isi arsip" className="lg:col-start-1">
          <ul className="space-y-3 text-sm">
            {ARCHIVE_CONTENTS.map(([icon, name, hint]) => (
              <li key={name} className="flex items-start gap-3">
                <IconBadge icon={icon} size="sm" />
                <div>
                  <div className="font-semibold">{name}</div>
                  <div className="text-slate-500">{hint}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <SchoolNameForm className="lg:col-start-1" />
      </div>
    </>
  )
}
