import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Activity, ChevronRight, FileSpreadsheet, GraduationCap, Newspaper, Presentation, TrendingUp, Users } from 'lucide-react'
import api, { getErrorMessage } from '../../lib/api.js'
import { formatNumber, lastSeen } from '../../lib/format.js'
import { Alert, Avatar, Spinner } from '../../components/ui.jsx'
import { IconBadge } from '../../components/Icons.jsx'
import { AccountStatus, BarList, ColumnChart, Meter, PageHeader, Panel, StatTile } from '../../components/admin/AdminUI.jsx'

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

function weekRange(iso) {
  const start = new Date(`${iso}T00:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return `${shortDate(iso)} – ${end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
}

export default function DashboardPage() {
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get('/admin/stats').then((r) => r.data) })
  const pending = useQuery({
    queryKey: ['admin', 'students', { parentStatus: 'pending', limit: 6 }],
    queryFn: () => api.get('/admin/students', { params: { parentStatus: 'pending', limit: 6 } }).then((r) => r.data),
  })

  if (stats.isPending) return <Spinner />
  if (stats.isError) return <Alert>{getErrorMessage(stats.error)}</Alert>

  const { totals, postsByWeek, studentsPerClass, academicYear } = stats.data
  const activatedPercent = totals.parents ? Math.round((totals.parentsActivated / totals.parents) * 100) : 0

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={academicYear ? `Ringkasan sekolah · Tahun ajaran ${academicYear.name}` : 'Belum ada tahun ajaran aktif'}
      />

      {!academicYear && (
        <div className="mb-4">
          <Alert variant="warning">
            Buat dan aktifkan tahun ajaran terlebih dahulu di menu{' '}
            <Link to="/admin/tahun-ajaran" className="font-bold underline">
              Tahun Ajaran
            </Link>
            .
          </Alert>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={GraduationCap} label="Siswa aktif" value={formatNumber(totals.students)} hint={`${studentsPerClass.length} kelas`} />
        <StatTile icon={Presentation} label="Guru aktif" value={formatNumber(totals.teachers)} />
        <StatTile icon={Activity} label="Pengguna aktif" value={formatNumber(totals.activeUsers7d)} hint="Login dalam 7 hari terakhir" />
        <StatTile icon={Newspaper} label="Total postingan" value={formatNumber(totals.posts)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Postingan per minggu" description="12 minggu terakhir" className="lg:col-span-2">
          <ColumnChart
            caption="Jumlah postingan per minggu, 12 minggu terakhir"
            labelEvery={3}
            data={postsByWeek.map((w) => ({ key: w.week, label: shortDate(w.week), detail: weekRange(w.week), value: w.count }))}
          />
        </Panel>

        <Panel title="Aktivasi akun orang tua" description="Sudah login & mengganti password awal">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-slate-800">{activatedPercent}%</span>
            <span className="text-sm text-slate-500">
              {formatNumber(totals.parentsActivated)} dari {formatNumber(totals.parents)} orang tua
            </span>
          </div>
          <div className="mt-3">
            <Meter value={totals.parentsActivated} max={totals.parents} label="Persentase akun orang tua yang sudah aktif" />
          </div>
          <Link
            to="/admin/siswa?parentStatus=pending"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
          >
            Lihat yang belum login <ChevronRight className="size-4" />
          </Link>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Siswa per kelas" description="Tahun ajaran aktif" className="lg:col-span-2">
          {studentsPerClass.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada kelas di tahun ajaran aktif.</p>
          ) : (
            <BarList
              caption="Jumlah siswa aktif per kelas"
              data={studentsPerClass.map((c) => ({ key: c.id, label: c.label, value: c.count }))}
              renderLink={(d, row) => (
                <Link to={`/admin/kelas/${d.key}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-slate-50">
                  {row}
                </Link>
              )}
            />
          )}
        </Panel>

        <Panel title="Orang tua belum login" bodyClassName="p-0">
          {pending.isPending ? (
            <Spinner />
          ) : pending.data?.items.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Semua orang tua sudah mengaktifkan akunnya.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pending.data?.items.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={s.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.fullName}</div>
                    <div className="truncate text-xs text-slate-500">
                      {s.classroom?.label ?? 'Tanpa kelas'} · {lastSeen(s.parent?.lastLoginAt)}
                    </div>
                  </div>
                  <AccountStatus account={s.parent} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <h2 className="mt-6 mb-2 text-sm font-bold text-slate-500">Pintasan</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { to: '/admin/import', icon: FileSpreadsheet, label: 'Import akun dari Excel' },
          { to: '/admin/kelas', icon: TrendingUp, label: 'Proses kenaikan kelas' },
          { to: '/admin/siswa', icon: Users, label: 'Kelola siswa & orang tua' },
        ].map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200/60 hover:ring-brand-300"
            >
              <IconBadge icon={s.icon} />
              <span className="flex-1 text-sm font-semibold">{s.label}</span>
              <ChevronRight className="size-4 text-slate-400" />
            </Link>
          ))}
      </div>
    </>
  )
}
