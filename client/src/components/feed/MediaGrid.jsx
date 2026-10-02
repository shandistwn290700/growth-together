import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react'

function VideoPlayer({ media, className = '' }) {
  return (
    <video controls playsInline preload="none" poster={media.posterUrl} className={`bg-black ${className}`}>
      <source src={media.url} type="video/mp4" />
      {/* Cadangan jika versi yang dikompres Cloudinary belum selesai diproses */}
      <source src={media.originalUrl} />
    </video>
  )
}

function Thumb({ media, onOpen, overlay }) {
  return (
    <button onClick={onOpen} className="relative block size-full overflow-hidden bg-slate-100" aria-label="Lihat media">
      <img src={media.type === 'video' ? media.posterUrl : media.url} alt="" loading="lazy" className="size-full object-cover" />
      {media.type === 'video' && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-600/90 text-white shadow-lg">
            <Play className="ml-0.5 size-6 fill-white" />
          </span>
        </span>
      )}
      {overlay && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-3xl font-bold text-white">
          {overlay}
        </span>
      )}
    </button>
  )
}

// Tata letak seperti Facebook: 1 media penuh, 2 berdampingan, 3+ grid dengan "+N" di kotak terakhir.
export default function MediaGrid({ media }) {
  const [openIndex, setOpenIndex] = useState(null)
  if (!media?.length) return null

  if (media.length === 1) {
    const only = media[0]
    return only.type === 'video' ? (
      <VideoPlayer media={only} className="max-h-[70vh] w-full" />
    ) : (
      <>
        <button onClick={() => setOpenIndex(0)} className="block w-full bg-slate-100" aria-label="Lihat foto">
          <img src={only.url} alt="" loading="lazy" className="mx-auto max-h-[70vh] object-contain" />
        </button>
        {openIndex !== null && <Lightbox media={media} index={openIndex} onChange={setOpenIndex} />}
      </>
    )
  }

  const shown = media.slice(0, 4)
  const layout = media.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'

  return (
    <>
      <div className={`grid aspect-square gap-0.5 ${layout}`}>
        {shown.map((m, i) => (
          <div key={m.id} className={media.length === 3 && i === 0 ? 'row-span-2' : ''}>
            <Thumb
              media={m}
              onOpen={() => setOpenIndex(i)}
              overlay={i === 3 && media.length > 4 ? `+${media.length - 4}` : null}
            />
          </div>
        ))}
      </div>
      {openIndex !== null && <Lightbox media={media} index={openIndex} onChange={setOpenIndex} />}
    </>
  )
}

export function Lightbox({ media, index, onChange }) {
  const current = media[index]
  const close = () => onChange(null)
  const go = (delta) => onChange((index + delta + media.length) % media.length)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onChange(null)
      if (e.key === 'ArrowRight') onChange((index + 1) % media.length)
      if (e.key === 'ArrowLeft') onChange((index - 1 + media.length) % media.length)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [index, media.length, onChange])

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={close}>
      <div className="max-h-full max-w-full p-4" onClick={(e) => e.stopPropagation()}>
        {current.type === 'video' ? (
          <VideoPlayer key={current.id} media={current} className="max-h-[85vh] max-w-full" />
        ) : (
          <img src={current.url} alt="" className="max-h-[85vh] max-w-full object-contain" />
        )}
      </div>
      <button
        onClick={close}
        className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        aria-label="Tutup"
      >
        <X className="size-6" />
      </button>
      {media.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
            className="absolute left-3 flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
            className="absolute right-3 flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            aria-label="Berikutnya"
          >
            <ChevronRight className="size-6" />
          </button>
          <span className="absolute bottom-4 rounded-full bg-white/15 px-3 py-1 text-sm text-white">
            {index + 1} / {media.length}
          </span>
        </>
      )}
    </div>
  )
}
