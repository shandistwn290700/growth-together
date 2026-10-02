import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlay } from '../lib/overlay.js'
import { motionDelay } from '../lib/motion.js'
import { confirmAction } from '../lib/alert.js'

const SIZES = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Jendela berefek kaca seperti "Buat postingan" di Facebook: halaman di belakang diburamkan,
// jendelanya sendiri tembus pandang buram. Di HP muncul dari bawah sebagai lembar (sheet).
// - onClose dipanggil setelah animasi tutup selesai.
// - locked: jendela tidak bisa ditutup (mis. saat upload berjalan).
// - confirmClose: { title, text, confirmText, cancelText } untuk konfirmasi sebelum ditutup
//   (mis. ada tulisan yang belum diposting).
// - ref.current.close(): tutup dari dalam tanpa konfirmasi (mis. setelah berhasil posting).
export default function GlassDialog({ ref, title, onClose, locked = false, confirmClose, footer, size = 'md', children }) {
  const titleId = useId()
  const panel = useRef(null)
  const [closing, setClosing] = useState(false)

  const finish = () => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, motionDelay(180))
  }
  const asking = useRef(false)
  const requestClose = async () => {
    if (locked || closing || asking.current) return
    if (confirmClose) {
      asking.current = true
      const ok = await confirmAction({ tone: 'warning', ...confirmClose })
      asking.current = false
      if (!ok) return
    }
    finish()
  }
  useImperativeHandle(ref, () => ({ close: finish }))
  useOverlay(requestClose)

  // Fokus masuk ke jendela saat dibuka (kecuali sudah ada isian autoFocus), dan kembali ke
  // tombol pembukanya saat ditutup, agar pengguna keyboard tidak kehilangan posisi.
  useEffect(() => {
    const opener = document.activeElement
    if (!panel.current.contains(document.activeElement)) panel.current.focus()
    return () => opener?.focus?.({ preventScroll: true })
  }, [])

  // Tab berputar di dalam jendela saja.
  const trapTab = (e) => {
    if (e.key !== 'Tab') return
    const items = [...panel.current.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.getClientRects().length)
    if (items.length === 0) return
    const first = items[0]
    const last = items.at(-1)
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button
        tabIndex={-1}
        aria-label="Tutup"
        onClick={requestClose}
        className={`glass-backdrop absolute inset-0 cursor-default ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={`glass-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl outline-none sm:rounded-2xl ${SIZES[size]} ${
          closing ? 'animate-sheet-out sm:animate-dialog-out' : 'animate-sheet-in sm:animate-dialog-in'
        }`}
      >
        <header className="relative flex h-14 shrink-0 items-center justify-center border-b border-slate-900/[0.07] px-14">
          {/* Pegangan kecil di atas lembar, seperti aplikasi HP */}
          <span className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-900/15 sm:hidden" aria-hidden="true" />
          <h2 id={titleId} className="truncate text-lg font-extrabold text-slate-800">
            {title}
          </h2>
          <button
            onClick={requestClose}
            disabled={locked}
            className="absolute right-3 flex size-9 items-center justify-center rounded-full bg-slate-900/[0.06] text-slate-600 transition-colors hover:bg-slate-900/10 disabled:opacity-40"
            aria-label="Tutup"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${footer ? '' : 'pb-[env(safe-area-inset-bottom)]'}`}>{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-900/[0.07] bg-white/35 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
