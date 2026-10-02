import { Fragment, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { timelineKey } from '../../lib/feedCache.js'
import { useInfiniteScroll } from '../../lib/useInfiniteScroll.js'
import { BookOpen, Play, Sprout } from 'lucide-react'
import { Alert, Card, Spinner } from '../ui.jsx'
import { IconBadge } from '../Icons.jsx'
import PostCard from '../feed/PostCard.jsx'
import MediaViewer from '../feed/MediaViewer.jsx'

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
    <Card className="flex flex-col items-center text-center">
      <IconBadge icon={Sprout} size="xl" tone="soft" />
      <p className="mt-3 text-sm text-slate-600">{text}</p>
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
                <span className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-sm font-bold text-white">
                  <BookOpen className="size-4" strokeWidth={2.2} aria-hidden /> {cls.label} · {cls.academicYear}
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
              <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-brand-600/90 text-white">
                <Play className="ml-px size-3.5 fill-white" aria-label="Video" />
              </span>
            )}
          </button>
        ))}
      </div>
      <div ref={sentinel} />
      {query.isFetchingNextPage && <Spinner />}
      {openIndex !== null && (
        <MediaViewer media={items} index={openIndex} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  )
}
