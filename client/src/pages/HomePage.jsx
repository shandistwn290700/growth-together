import { useQuery } from '@tanstack/react-query'
import api from '../lib/api.js'

export default function HomePage() {
  // Sementara: cek koneksi ke backend. Akan diganti dengan feed di Tahap 3.
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then((res) => res.data),
  })

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold">Beranda</h1>
        <p className="mt-1 text-slate-600">Feed perkembangan siswa akan tampil di sini.</p>
      </section>
      <section className="rounded-xl bg-white p-5 text-sm shadow-sm">
        <span className="font-semibold">Status server: </span>
        {health.isPending && <span className="text-slate-500">memeriksa…</span>}
        {health.isError && <span className="text-red-600">tidak terhubung</span>}
        {health.isSuccess && <span className="text-brand-700">terhubung ({health.data.app})</span>}
      </section>
    </div>
  )
}
