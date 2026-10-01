import { useEffect, useRef } from 'react'

// Muat halaman berikutnya otomatis saat elemen penanda (sentinel) mendekati layar.
// Pakai: const sentinel = useInfiniteScroll(query); ... <div ref={sentinel} />
export function useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage }) {
  const sentinel = useRef(null)

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

  return sentinel
}
