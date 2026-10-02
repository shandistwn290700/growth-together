// BERKAS SEMENTARA untuk uji tampilan MediaViewer — hapus setelah selesai.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import './index.css'
import MediaViewer from './components/feed/MediaViewer.jsx'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
const me = { id: 1, role: 'teacher', displayName: 'Siti Aminah', avatarUrl: null }
qc.setQueryData(['me'], me)
const img = (c1, c2, w, h, t) =>
  'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" font-size="64" font-family="sans-serif" fill="white" text-anchor="middle">${t}</text></svg>`)
const now = new Date(Date.now() - 2 * 3600e3).toISOString()
const parent = { id: 9, role: 'parent', displayName: 'Ahmad', avatarUrl: null }
const post = {
  id: 77, author: { id: 1, role: 'teacher', displayName: 'Siti Aminah', avatarUrl: null }, students: [{ id: 5, fullName: 'Ahmad Fauzi', nickname: 'Ahmad' }, { id: 6, fullName: 'Aisyah', nickname: 'Aisyah' }],
  classroom: { id: 3, label: 'Kelas 1 Abu Bakar' }, audience: null, createdAt: now, updatedAt: now,
  caption: 'Hari ini anak-anak belajar menanam kacang hijau di halaman sekolah 🌱\nMereka menyiram, mengamati, dan mencatat pertumbuhannya setiap pagi. Terima kasih Ayah Bunda yang sudah membawakan gelas plastik bekas!\n\nMinggu depan kita akan ukur tingginya bersama.',
  media: [
    { id: 1, type: 'image', url: img('#0d9488', '#99f6e4', 1600, 1000, 'Foto 1') },
    { id: 2, type: 'image', url: img('#f97316', '#fde68a', 900, 1400, 'Foto 2') },
    { id: 3, type: 'image', url: img('#4f46e5', '#c7d2fe', 1200, 1200, 'Foto 3') },
  ],
  reactions: { total: 12, counts: { like: 8, love: 3, care: 1 }, mine: 'love' }, commentCount: 3, canEdit: true, canDelete: true,
}
qc.setQueryData(['comments', 77], {
  students: [{ id: 5, fullName: 'Ahmad Fauzi', nickname: 'Ahmad' }, { id: 6, fullName: 'Aisyah', nickname: 'Aisyah' }],
  threads: [{ student: { id: 5, fullName: 'Ahmad Fauzi' }, comments: [
    { id: 1, content: 'MasyaAllah, Ahmad semangat sekali cerita soal kacang hijaunya di rumah 😊', createdAt: now, author: parent, replies: [
      { id: 2, content: 'Alhamdulillah, Ahmad juga rajin menyiram tiap pagi, Bun.', createdAt: now, author: me, replies: [] }] },
    { id: 3, content: 'Boleh minta fotonya dikirim lagi Bu?', createdAt: now, author: parent, replies: [] },
  ] }],
})

function App() {
  const [index, setIndex] = useState(Number(location.hash.match(/i(\d)/)?.[1] ?? 0))
  if (location.hash.includes('sheet'))
    setTimeout(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Komentar')?.click(), 400)
  return <MediaViewer media={post.media} index={index} onIndexChange={setIndex} onClose={() => {}} post={post} />
}
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={qc}><MemoryRouter><App /></MemoryRouter></QueryClientProvider>,
)
