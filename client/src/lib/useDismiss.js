import { useEffect, useRef } from 'react'

// Tutup popup/menu saat klik di luar elemennya atau menekan Escape.
// Pakai: const ref = useDismiss(open, setOpen); <div ref={ref}>…</div>
export function useDismiss(open, setOpen) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])
  return ref
}
