import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { KeyRound, Search } from 'lucide-react'
import api, { getErrorMessage } from '../../lib/api.js'
import { classLabel, useClassrooms } from '../../lib/queries.js'
import { lastSeen } from '../../lib/format.js'
import { Alert, Avatar, Select, Spinner } from '../../components/ui.jsx'
import { AccountStatus, PageHeader, Pagination, Panel } from '../../components/admin/AdminUI.jsx'

const LIMIT = 20

export default function StudentsPage() {
  // Filter disimpan di URL, jadi tautan seperti "/admin/siswa?parentStatus=pending" langsung terfilter.
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const classroomId = params.get('classroomId') ?? ''
  const parentStatus = params.get('parentStatus') ?? ''
  const [search, setSearch] = useState(params.get('search') ?? '')

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  // Cari otomatis 300 ms setelah berhenti mengetik.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (params.get('search') ?? '')) update({ search })
    }, 300)
    return () => clearTimeout(timer)
  })

  const classrooms = useClassrooms()
  const query = { page, limit: LIMIT, search: params.get('search') ?? '', classroomId, parentStatus }
  const students = useQuery({
    queryKey: ['admin', 'students', query],
    queryFn: () => api.get('/admin/students', { params: query }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

  const [resetResult, setResetResult] = useState(null)
  const reset = useMutation({
    mutationFn: (userId) => api.post(`/admin/users/${userId}/reset-password`).then((r) => r.data),
    onSuccess: (data) => {
      setResetResult(data)
      students.refetch()
    },
  })
  const confirmReset = (s) =>
    window.confirm(
      `Reset password akun orang tua ${s.fullName}?\n\nRiwayat chat terenkripsi akun ini tidak bisa dibuka lagi setelah reset.`,
    ) && reset.mutate(s.parent.id)

  const items = students.data?.items ?? []

  return (
    <>
      <PageHeader title="Siswa & Orang Tua" description="Setiap siswa punya satu akun orang tua (username = NIS)." />

      {reset.isError && <Alert>{getErrorMessage(reset.error)}</Alert>}
      {resetResult && (
        <div className="mb-4">
          <Alert variant="success">
            Password baru untuk <b>{resetResult.username}</b>: <code className="font-mono font-bold">{resetResult.password}</code> —
            catat sekarang, password ini tidak akan ditampilkan lagi.
          </Alert>
        </div>
      )}

      <Panel bodyClassName="p-0">
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-[1fr_14rem_12rem] sm:p-4">
          <label className="relative">
            <span className="sr-only">Cari siswa</span>
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau NIS…"
              className="w-full rounded-lg border border-slate-300 py-2.5 pr-3 pl-9 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
            />
          </label>
          <Select value={classroomId} onChange={(e) => update({ classroomId: e.target.value })} aria-label="Filter kelas">
            <option value="">Semua kelas</option>
            {(classrooms.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c)}
              </option>
            ))}
          </Select>
          <Select value={parentStatus} onChange={(e) => update({ parentStatus: e.target.value })} aria-label="Filter status akun orang tua">
            <option value="">Semua status akun</option>
            <option value="pending">Belum login</option>
            <option value="active">Sudah aktif</option>
          </Select>
        </div>

        {students.isPending ? (
          <Spinner />
        ) : students.isError ? (
          <div className="p-4">
            <Alert>{getErrorMessage(students.error)}</Alert>
          </div>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Tidak ada siswa yang cocok dengan filter.</p>
        ) : (
          <>
            {/* HP: kartu */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {items.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={s.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/siswa/${s.id}`} className="block truncate font-semibold text-brand-700">
                      {s.fullName}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <AccountStatus account={s.parent} />
                      <span>NIS {s.nis}</span>
                      <span>{s.classroom?.label ?? 'Tanpa kelas'}</span>
                    </div>
                  </div>
                  {s.parent && (
                    <button
                      onClick={() => confirmReset(s)}
                      disabled={reset.isPending}
                      aria-label={`Reset password orang tua ${s.fullName}`}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700"
                    >
                      <KeyRound className="size-3.5" /> Reset
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* Laptop: tabel */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Siswa</th>
                    <th className="px-3 py-2.5 font-semibold">NIS</th>
                    <th className="px-3 py-2.5 font-semibold">Kelas</th>
                    <th className="px-3 py-2.5 font-semibold">Akun orang tua</th>
                    <th className="px-3 py-2.5 font-semibold">Login terakhir</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.fullName} size="sm" />
                          <div className="min-w-0">
                            <Link to={`/siswa/${s.id}`} className="font-semibold text-brand-700 hover:underline">
                              {s.fullName}
                            </Link>
                            {s.nickname && <div className="text-xs text-slate-500">{s.nickname}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 tabular-nums">{s.nis}</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {s.classroom ? (
                          <Link to={`/admin/kelas/${s.classroom.id}`} className="hover:underline">
                            {s.classroom.label}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <AccountStatus account={s.parent} />
                          {s.parent && <span className="text-xs text-slate-400">{s.parent.username}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{lastSeen(s.parent?.lastLoginAt)}</td>
                      <td className="px-5 py-2.5 text-right">
                        {s.parent && (
                          <button
                            onClick={() => confirmReset(s)}
                            disabled={reset.isPending}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                          >
                            <KeyRound className="size-3.5" /> Reset password
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {students.data && students.data.total > 0 && (
          <div className="border-t border-slate-100">
            <Pagination page={page} limit={LIMIT} total={students.data.total} onChange={(p) => update({ page: String(p) })} />
          </div>
        )}
      </Panel>
    </>
  )
}
