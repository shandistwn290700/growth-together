import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Power } from 'lucide-react'
import api, { getErrorMessage } from '../../lib/api.js'
import { useTeachers } from '../../lib/queries.js'
import { lastSeen } from '../../lib/format.js'
import { Alert, Avatar, Spinner } from '../../components/ui.jsx'
import { AccountStatus, PageHeader, Panel } from '../../components/admin/AdminUI.jsx'

export default function TeachersPage() {
  const queryClient = useQueryClient()
  const teachers = useTeachers()
  const [resetResult, setResetResult] = useState(null)

  const reset = useMutation({
    mutationFn: (id) => api.post(`/admin/users/${id}/reset-password`).then((r) => r.data),
    onSuccess: (data) => {
      setResetResult(data)
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
  })
  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }) => api.patch(`/admin/users/${id}/status`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  })

  const confirmReset = (t) =>
    window.confirm(`Reset password ${t.fullName}?\n\nRiwayat chat terenkripsi akun ini tidak bisa dibuka lagi setelah reset.`) &&
    reset.mutate(t.id)
  const confirmToggle = (t) =>
    (t.isActive ? window.confirm(`Nonaktifkan akun ${t.fullName}? Guru ini tidak akan bisa login.`) : true) &&
    toggleActive.mutate({ id: t.id, isActive: !t.isActive })

  const list = teachers.data ?? []
  const action = 'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-brand-50'

  return (
    <>
      <PageHeader
        title="Guru"
        description="Akun guru dibuat lewat Import Akun. Wali kelas diatur dari halaman Kelas."
        actions={
          <Link to="/admin/import" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800">
            Import guru
          </Link>
        }
      />

      {(reset.isError || toggleActive.isError) && <Alert>{getErrorMessage(reset.error ?? toggleActive.error)}</Alert>}
      {resetResult && (
        <div className="mb-4">
          <Alert variant="success">
            Password baru untuk <b>{resetResult.username}</b>: <code className="font-mono font-bold">{resetResult.password}</code> —
            catat sekarang, password ini tidak akan ditampilkan lagi.
          </Alert>
        </div>
      )}

      <Panel bodyClassName="p-0">
        {teachers.isPending ? (
          <Spinner />
        ) : list.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Belum ada guru. Tambahkan lewat Import Akun.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((t) => (
              <li key={t.id} className="grid items-center gap-3 px-4 py-3 sm:px-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_8rem_9rem_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={t.fullName} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{t.fullName}</div>
                    <div className="truncate text-xs text-slate-500">@{t.username}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 text-sm">
                  {t.classrooms.length ? (
                    t.classrooms.map((c) => (
                      <Link key={c.id} to={`/admin/kelas/${c.id}`} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                        {c.label}
                      </Link>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">Belum menjadi wali kelas</span>
                  )}
                </div>
                <div>
                  <AccountStatus account={t} />
                </div>
                <div className="text-sm text-slate-600">
                  <span className="text-xs text-slate-400 md:hidden">Login terakhir: </span>
                  {lastSeen(t.lastLoginAt)}
                </div>
                <div className="flex gap-1 md:justify-end">
                  <button onClick={() => confirmReset(t)} disabled={reset.isPending} className={`${action} text-brand-700`}>
                    <KeyRound className="size-3.5" /> Reset
                  </button>
                  <button
                    onClick={() => confirmToggle(t)}
                    disabled={toggleActive.isPending}
                    className={`${action} ${t.isActive ? 'text-slate-500 hover:text-red-600' : 'text-brand-700'}`}
                  >
                    <Power className="size-3.5" /> {t.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
