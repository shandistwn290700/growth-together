import { Link } from 'react-router'
import { ROLE_LABELS, useMe } from '../lib/auth.js'
import { Card } from '../components/ui.jsx'

export default function ProfilePage() {
  const { data: me } = useMe()

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-extrabold text-brand-700">
          {me.displayName?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{me.displayName}</h1>
          <p className="text-sm text-slate-600">
            {ROLE_LABELS[me.role]}
            {me.student && ` · NIS ${me.student.nis}`}
          </p>
          <Link to="/ganti-password" className="text-sm font-semibold text-brand-700 hover:underline">
            Ganti password
          </Link>
        </div>
      </Card>
      <Card>
        <p className="text-slate-600">Timeline perkembangan siswa per kelas akan tampil di sini (Tahap 4).</p>
      </Card>
    </div>
  )
}
