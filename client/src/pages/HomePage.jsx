import { useEffect, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import api, { getErrorMessage } from '../lib/api.js'
import { useMe } from '../lib/auth.js'
import { FEED_KEY } from '../lib/feedCache.js'
import { Alert, Button, Card, Spinner } from '../components/ui.jsx'
import PostComposer from '../components/feed/PostComposer.jsx'
import PostCard from '../components/feed/PostCard.jsx'

export default function HomePage() {
  const { data: me } = useMe()
  const feed = useInfiniteQuery({
    queryKey: FEED_KEY,
    queryFn: ({ pageParam }) => api.get('/posts', { params: { cursor: pageParam } }).then((r) => r.data),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  // Muat halaman berikutnya otomatis saat penanda di bawah feed terlihat.
  const sentinel = useRef(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && !isFetchingNextPage && fetchNextPage(),
      { rootMargin: '600px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const posts = feed.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PostComposer />

      {feed.isPending ? (
        <Spinner />
      ) : feed.isError ? (
        <Alert>{getErrorMessage(feed.error)}</Alert>
      ) : posts.length === 0 ? (
        <Card className="text-center">
          <p className="text-4xl">🌱</p>
          <p className="mt-2 font-bold">Belum ada postingan</p>
          <p className="text-sm text-slate-600">
            {me.role === 'parent'
              ? 'Bagikan momen pertama ananda, atau tunggu kabar dari wali kelas.'
              : 'Bagikan kegiatan kelas pertama Anda.'}
          </p>
        </Card>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          <div ref={sentinel} />
          {isFetchingNextPage && <Spinner label="Memuat postingan lainnya…" />}
          {feed.isFetchNextPageError && (
            <div className="text-center">
              <Button variant="secondary" onClick={() => fetchNextPage()}>
                Coba lagi
              </Button>
            </div>
          )}
          {!hasNextPage && posts.length > 3 && <p className="py-4 text-center text-sm text-slate-500">Sudah sampai postingan paling awal.</p>}
        </>
      )}
    </div>
  )
}
