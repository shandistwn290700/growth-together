import { Fragment, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { timelineKey } from '../../lib/feedCache.js'
import { useInfiniteScroll } from '../../lib/useInfiniteScroll.js'
import { Alert, Card, Spinner } from '../ui.jsx'
import PostCard from '../feed/PostCard.jsx'
import { Lightbox } from '../feed/MediaGrid.jsx'

function usePaged(queryKey, url, classroomId) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      api.get(url, { params: { cursor: pageParam, classroomId: classroomId ?? undefined } }).then((r) => r.data),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
  const sentinel = useInfiniteScroll(query)
  return { query, sentinel, items: query.data?.pages.flatMap((p) => p.items) ?? [] }
}

function EmptyState({ text }) {
  return (
    <Card className="text-center">
      <p className="text-4xl">🌱</p>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </Card>
  )
}

// Timeline siswa. Saat menampilkan semua kelas, ada judul pemisah setiap kali kelas berganti.
export function StudentTimeline({ studentId, classroomId, history }) {
  const { query, sentinel, items } = usePaged(timelineKey(studentId, classroomId), `/students/${studentId}/posts`, classroomId)
  const classById = Object.fromEntries(history.map((h) => [h.classroomId, h]))

  if (query.isPending) return <Spinner />
  if (query.isError) return <Alert>{getErrorMessage(query.error)}</Alert>
  if (items.length === 0) return <EmptyState text="Belum ada momen di periode ini." />

  return (
    <div className="space-y-4">
      {items.map((post, i) => {
        const showDivider = !classroomId && post.timelineClassroomId !== items[i - 1]?.timelineClassroomId
        const cls = classById[post.timelineClassroomId]
        return (
          <Fragment key={post.id}>
            {showDivider && cls && (
              <div className="flex items-center gap-3 pt-2">
                <span className="h-px flex-1 bg-slate-300" />
                <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
                  📚 {cls.label} · {cls.academicYear}
                </span>
                <span className="h-px flex-1 bg-slate-300" />
              </div>
            )}
            <PostCard post={post} />
          </Fragment>
        )
      })}
      <div ref={sentinel} />
      {query.isFetchingNextPage && <Spinner label="Memuat momen sebelumnya…" />}
    </div>
  )
}

// Galeri: semua foto/video siswa dalam grid, cocok sebagai portofolio.
export function StudentGallery({ studentId, classroomId }) {
  const { query, sentinel, items } = usePaged(['gallery', studentId, classroomId ?? 'all'], `/students/${studentId}/media`, classroomId)
  const [openIndex, setOpenIndex] = useState(null)

  if (query.isPending) return <Spinner />
  if (query.isError) return <Alert>{getErrorMessage(query.error)}</Alert>
  if (items.length === 0) return <EmptyState text="Belum ada foto atau video di periode ini." />

  return (
    <>
      <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl">
        {items.map((m, i) => (
          <button key={m.id} onClick={() => setOpenIndex(i)} className="relative aspect-square bg-slate-200" aria-label="Lihat media">
            <img src={m.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
            {m.type === 'video' && (
              <span className="absolute top-1.5 right-1.5 rounded bg-black/60 px-1.5 text-xs text-white">▶ Video</span>
            )}
          </button>
        ))}
      </div>
      <div ref={sentinel} />
      {query.isFetchingNextPage && <Spinner />}
      {openIndex !== null && <Lightbox media={items} index={openIndex} onChange={setOpenIndex} />}
    </>
  )
}
