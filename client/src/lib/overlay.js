import { useEffect, useRef } from 'react'

// Jendela yang menutupi halaman (dialog, lightbox foto) bisa bertumpuk, misalnya foto dibuka dari
// jendela komentar. Escape hanya menutup lapisan paling atas, dan halaman di belakang baru bisa
// digulir lagi setelah semua lapisan tertutup.
const layers = []

function onKeyDown(e) {
  if (e.key !== 'Escape' || layers.length === 0) return
  e.preventDefault()
  layers.at(-1).current?.()
}

// Pakai: useOverlay(tutup) di komponen jendela; selama komponen tampil, halaman terkunci.
export function useOverlay(onEscape) {
  const handler = useRef(onEscape)
  useEffect(() => {
    handler.current = onEscape
  })

  useEffect(() => {
    const layer = handler
    if (layers.length === 0) {
      document.addEventListener('keydown', onKeyDown)
      document.body.style.overflow = 'hidden'
    }
    layers.push(layer)
    return () => {
      layers.splice(layers.indexOf(layer), 1)
      if (layers.length === 0) {
        document.removeEventListener('keydown', onKeyDown)
        document.body.style.overflow = ''
      }
    }
  }, [])
}
