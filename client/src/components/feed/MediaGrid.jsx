import { useRef, useState } from 'react'
import { Maximize2, Play } from 'lucide-react'
import MediaViewer from './MediaViewer.jsx'

export function VideoPlayer({ media, className = '', ...props }) {
  return (
    <video controls playsInline preload="none" poster={media.posterUrl} className={`bg-black ${className}`} {...props}>
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
// Mengklik media membuka penampil layar penuh yang tetap menampilkan caption, reaksi, dan komentar.
export default function MediaGrid({ post }) {
  const media = post.media
  const [openIndex, setOpenIndex] = useState(null)
  const inlineVideo = useRef(null)
  if (!media?.length) return null

  const viewer = openIndex !== null && (
    <MediaViewer media={media} index={openIndex} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} post={post} />
  )

  if (media.length === 1) {
    const only = media[0]
    return only.type === 'video' ? (
      <div className="relative">
        <VideoPlayer ref={inlineVideo} media={only} className="max-h-[70vh] w-full" />
        <button
          onClick={() => {
            inlineVideo.current?.pause() // lanjut ditonton di layar penuh, jangan berbunyi dobel
            setOpenIndex(0)
          }}
          className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          aria-label="Buka layar penuh"
          title="Buka layar penuh"
        >
          <Maximize2 className="size-4" />
        </button>
        {viewer}
      </div>
    ) : (
      <>
        <button onClick={() => setOpenIndex(0)} className="block w-full bg-slate-100" aria-label="Lihat foto">
          <img src={only.url} alt="" loading="lazy" className="mx-auto max-h-[70vh] object-contain" />
        </button>
        {viewer}
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
      {viewer}
    </>
  )
}
