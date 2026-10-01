import { useMe } from '../lib/auth.js'
import { Card } from '../components/ui.jsx'

export default function HomePage() {
  const { data: me } = useMe()

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card>
        <h1 className="text-xl font-bold">Assalamu'alaikum, {me.displayName}</h1>
        <p className="mt-1 text-slate-600">Feed perkembangan siswa akan tampil di sini (Tahap 3).</p>
      </Card>
    </div>
  )
}
