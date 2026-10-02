import { useSyncExternalStore } from 'react'

// true/false sesuai media query CSS, dan ikut berubah saat ukuran layar berubah (mis. HP diputar).
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}
