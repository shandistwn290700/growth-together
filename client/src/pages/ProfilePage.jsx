import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import api from '../lib/api.js'
import { ROLE_LABELS, useMe } from '../lib/auth.js'
import { classLabel, useClassrooms } from '../lib/queries.js'
import { Card, Spinner } from '../components/ui.jsx'
import PhotoUploader from '../components/profile/PhotoUploader.jsx'
import StudentProfile from '../components/profile/StudentProfile.jsx'

// /profil — orang tua melihat profil & timeline anaknya; guru/admin melihat profilnya sendiri.
export default function ProfilePage() {
  const { data: me } = useMe()
  if (me.role === 'parent') return <StudentProfile studentId={me.student.id} isOwnChild />
  return <StaffProfile me={me} />
}

// /siswa/:id — profil siswa dari sudut pandang guru/admin (akses dicek di server).
export function StudentProfilePage() {
  const { id } = useParams()
  const { data: me } = useMe()
  const studentId = Number(id)
  return <StudentProfile key={studentId} studentId={studentId} isOwnChild={me.student?.id === studentId} />
}

function StaffProfile({ me }) {
  const queryClient = useQueryClient()
  const classrooms = useClassrooms()
  const mine = (classrooms.data ?? []).filter((c) => c.teachers.some((t) => t.id === me.id))

  const saveAvatar = async (uploaded) => {
    const { data } = await api.put('/auth/avatar', uploaded)
    queryClient.setQueryData(['me'], data)
    queryClient.invalidateQueries({ queryKey: ['posts'] })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="h-28 bg-gradient-to-r from-brand-700 via-brand-600 to-brand-400 sm:h-36" />
        <div className="flex flex-col items-center gap-3 px-5 pb-5 sm:flex-row sm:items-end">
          <div className="-mt-16 sm:-mt-20">
            <PhotoUploader name={me.displayName} photoUrl={me.avatarUrl} canEdit save={saveAvatar} />
          </div>
          <div className="min-w-0 flex-1 text-center sm:pb-2 sm:text-left">
            <h1 className="text-2xl font-extrabold">{me.displayName}</h1>
            <p className="text-slate-600">
              {ROLE_LABELS[me.role]} · @{me.username}
            </p>
          </div>
          <Link to="/ganti-password" className="text-sm font-semibold text-brand-700 hover:underline sm:pb-2">
            Ganti password
          </Link>
        </div>
      </section>

      {me.role === 'teacher' && (
        <Card>
          <h2 className="font-bold">Kelas yang saya ampu tahun ini</h2>
          {classrooms.isPending ? (
            <Spinner />
          ) : mine.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">Belum ada kelas di tahun ajaran aktif.</p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {mine.map((c) => (
                <li key={c.id}>
                  <Link to={`/kelas/${c.id}`} className="block rounded-lg border border-slate-200 p-3 hover:border-brand-600">
                    <span className="font-bold text-brand-700">{classLabel(c)}</span>
                    <span className="block text-sm text-slate-600">{c.studentCount} siswa</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-slate-500">Buka kelas, lalu klik nama siswa untuk melihat timeline perkembangannya.</p>
        </Card>
      )}
    </div>
  )
}
