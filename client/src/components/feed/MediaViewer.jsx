import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, MessageCircle, X } from 'lucide-react'
import api, { getErrorMessage } from '../../lib/api.js'
import { useMe } from '../../lib/auth.js'
import { postKey } from '../../lib/feedCache.js'
import { useComments } from '../../lib/queries.js'
import { authorName, fullDate, timeAgo } from '../../lib/format.js'
import { useOverlay } from '../../lib/overlay.js'
import { useMediaQuery } from '../../lib/useMediaQuery.js'
import { Alert, Spinner } from '../ui.jsx'
import PostContent from './PostContent.jsx'
import { CommentFooter, CommentList } from './CommentDialog.jsx'
import { VideoPlayer } from './MediaGrid.jsx'
import { ReactionButton, ReactionSummary } from './Reactions.jsx'

const DESKTOP = '(min-width: 1024px)'

/**
 * Penampil foto/video layar penuh seperti Facebook.
 * - Laptop: media di kiri, panel postingan (caption, reaksi, komentar) di kanan.
 * - HP: media penuh dengan caption & tombol reaksi/komentar di bawah; komentar dibuka sebagai lembar.
 *   Geser kiri/kanan untuk pindah media, geser ke bawah untuk menutup, ketuk untuk menyembunyikan keterangan.
 *
 * media/index/onIndexChange/onClose mengatur media yang tampil. `post` adalah postingan pemilik media
 * (dari feed). Jika tidak diberikan (galeri profil, media dari banyak postingan), postingan diambil
 * dari server sesuai media yang sedang tampil (media.postId).
 */
export default function MediaViewer({ media, index, onIndexChange, onClose, post: givenPost }) {
  const current = media[index]
  const fetched = useQuery({
    queryKey: postKey(current?.postId),
    queryFn: () => api.get(`/posts/${current.postId}`).then((r) => r.data),
    enabled: !givenPost && Boolean(current?.postId),
  })
  const post = givenPost ?? fetched.data
  const isDesktop = useMediaQuery(DESKTOP)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const dialog = useRef(null)
  const count = media.length
  const showChrome = chromeVisible || isDesktop

  useOverlay(onClose)

  // Panah kiri/kanan di keyboard, kecuali saat sedang mengetik komentar.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'ArrowRight' && index < count - 1) onIndexChange(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, count, onIndexChange])

  // Fokus masuk ke penampil saat dibuka, dan kembali ke foto yang diklik saat ditutup.
  useEffect(() => {
    const opener = document.activeElement
    dialog.current.focus()
    return () => opener?.focus?.({ preventScroll: true })
  }, [])

  // Media yang sedang dibuka hilang (mis. postingannya dihapus): tutup penampil.
  useEffect(() => {
    if (!current) onClose()
  })
  if (!current) return null

  const roundButton = 'flex size-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/65'

  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Foto dan video postingan"
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex animate-fade-in bg-black outline-none"
    >
      <div className="relative min-w-0 flex-1">
        <Slider
          media={media}
          index={index}
          onChange={onIndexChange}
          onTap={() => setChromeVisible((v) => !v)}
          onDismiss={onClose}
        />

        <div
          className={`pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-opacity duration-200 ${
            showChrome ? '' : 'opacity-0'
          }`}
        >
          <button onClick={onClose} className={`pointer-events-auto ${roundButton}`} aria-label="Tutup">
            <X className="size-6" />
          </button>
          {count > 1 && (
            <span className="rounded-full bg-black/45 px-3 py-1 text-sm font-semibold text-white tabular-nums" aria-live="polite">
              {index + 1} / {count}
            </span>
          )}
          <span className="size-10" aria-hidden="true" />
        </div>

        {count > 1 && showChrome && (
          <>
            {index > 0 && (
              <button
                onClick={() => onIndexChange(index - 1)}
                className={`absolute top-1/2 left-3 hidden -translate-y-1/2 sm:flex ${roundButton}`}
                aria-label="Sebelumnya"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}
            {index < count - 1 && (
              <button
                onClick={() => onIndexChange(index + 1)}
                className={`absolute top-1/2 right-3 hidden -translate-y-1/2 sm:flex ${roundButton}`}
                aria-label="Berikutnya"
              >
                <ChevronRight className="size-6" />
              </button>
            )}
          </>
        )}

        {!isDesktop && post && <MobileDetails key={post.id} post={post} hidden={!showChrome} onComments={() => setCommentsOpen(true)} />}
      </div>

      {isDesktop && (
        <aside className="viewer-panel flex w-[380px] shrink-0 flex-col xl:w-[420px]">
          {post ? (
            <PostPanel key={post.id} post={post} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              {fetched.isError ? <Alert>{getErrorMessage(fetched.error)}</Alert> : <Spinner />}
            </div>
          )}
        </aside>
      )}

      {!isDesktop && commentsOpen && post && <CommentSheet post={post} onClose={() => setCommentsOpen(false)} />}
    </div>,
    document.body,
  )
}

// ---------- Geser (swipe) ----------

const SWIPE_RATIO = 0.18 // geser lebih dari 18% lebar layar = pindah media

function Slider({ media, index, onChange, onTap, onDismiss }) {
  const gesture = useRef(null)
  const [offset, setOffset] = useState(null) // { x, y } selama jari/mouse menggeser
  const count = media.length

  const finish = (e, cancelled = false) => {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    gesture.current = null
    setOffset(null)
    if (cancelled) return
    if (!g.axis) return onTap()

    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    const distance = g.axis === 'x' ? Math.abs(dx) : Math.abs(dy)
    const fast = distance / Math.max(1, e.timeStamp - g.t) > 0.5 // jentikan cepat juga dihitung
    if (g.axis === 'x') {
      if (distance > g.width * SWIPE_RATIO || (fast && distance > 30)) {
        if (dx < 0 && index < count - 1) onChange(index + 1)
        if (dx > 0 && index > 0) onChange(index - 1)
      }
    } else if (distance > 140 || (fast && distance > 60)) {
      onDismiss()
    }
  }

  return (
    <div
      className="absolute inset-0 touch-none overflow-hidden select-none"
      onPointerDown={(e) => {
        if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
        // Tombol kontrol video tetap bisa dipakai: mouse di atas video, atau jari di area kontrol
        // (bagian bawah video), tidak memulai geseran.
        const video = e.target.closest('video')
        if (video && (e.pointerType === 'mouse' || e.clientY > video.getBoundingClientRect().bottom - 56)) return
        gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, axis: null, width: e.currentTarget.clientWidth }
      }}
      onPointerMove={(e) => {
        const g = gesture.current
        if (!g || e.pointerId !== g.id) return
        const dx = e.clientX - g.x
        const dy = e.clientY - g.y
        if (!g.axis) {
          if (Math.hypot(dx, dy) < 10) return // masih dianggap ketukan
          g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
          e.currentTarget.setPointerCapture(e.pointerId)
        }
        if (g.axis === 'x') {
          // Di media pertama/terakhir, geseran ditahan (terasa "mentok") seperti aplikasi HP.
          const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === count - 1)
          setOffset({ x: atEdge ? dx / 3 : dx, y: 0 })
        } else {
          setOffset({ x: 0, y: dy })
        }
      }}
      onPointerUp={(e) => finish(e)}
      onPointerCancel={(e) => finish(e, true)}
    >
      <div
        className="flex h-full"
        style={{
          transform: `translate3d(calc(${-index * 100}% + ${offset?.x ?? 0}px), ${offset?.y ?? 0}px, 0)`,
          transition: offset ? 'none' : 'transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms',
          opacity: offset?.y ? Math.max(0.3, 1 - Math.abs(offset.y) / 450) : 1,
        }}
      >
        {media.map((m, i) => (
          <div key={m.id} className="flex h-full w-full shrink-0 items-center justify-center" aria-hidden={i !== index}>
            {/* Hanya media yang tampil dan tetangganya yang dimuat */}
            {Math.abs(i - index) <= 1 && <Slide media={m} active={i === index} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function Slide({ media, active }) {
  if (media.type === 'video') {
    return active ? (
      <VideoPlayer media={media} autoPlay className="max-h-full max-w-full" />
    ) : (
      <img src={media.posterUrl} alt="" draggable={false} className="max-h-full max-w-full object-contain" />
    )
  }
  return <img src={media.url} alt="" draggable={false} className="max-h-full max-w-full object-contain" />
}

// ---------- Laptop: panel kanan ----------

function PostPanel({ post }) {
  const comments = useComments(post.id)
  const inputId = useId()

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <PostContent post={post} hideMedia onComments={() => document.getElementById(inputId)?.focus()} />
        <CommentList post={post} comments={comments} />
      </div>
      {comments.isSuccess && (
        <div className="shrink-0 border-t border-slate-900/[0.07] px-4 py-3">
          <CommentFooter post={post} data={comments.data} inputId={inputId} />
        </div>
      )}
    </>
  )
}

// ---------- HP: keterangan di atas foto & lembar komentar ----------

function MobileDetails({ post, hidden, onComments }) {
  const { data: me } = useMe()
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pt-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-white transition-opacity duration-200 ${
        hidden ? 'opacity-0' : ''
      }`}
    >
      <div className={hidden ? '' : 'pointer-events-auto'}>
        <p className="text-sm">
          <span className="font-bold">{authorName(post.author)}</span>
          <span className="text-white/70">
            {' · '}
            <time dateTime={post.createdAt} title={fullDate(post.createdAt)}>
              {timeAgo(post.createdAt)}
            </time>
          </span>
        </p>
        {post.caption && (
          // Ketuk caption untuk membaca selengkapnya (seperti Facebook)
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className={`mt-1 w-full text-left text-sm break-words whitespace-pre-line text-white/95 ${
              expanded ? 'block max-h-[40dvh] overflow-y-auto overscroll-contain' : 'line-clamp-3'
            }`}
          >
            {post.caption}
          </button>
        )}

        <div className="mt-2 flex min-h-5 items-center justify-between">
          <ReactionSummary post={post} canSeeNames={me.role !== 'parent'} variant="overlay" />
          {post.commentCount > 0 && (
            <button onClick={onComments} className="text-sm text-white/85 hover:underline">
              {post.commentCount} komentar
            </button>
          )}
        </div>
        <div className="mt-1 flex border-t border-white/15 pt-1">
          <ReactionButton post={post} variant="overlay" />
          <button
            onClick={onComments}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            <MessageCircle className="size-5" strokeWidth={2.2} /> Komentar
          </button>
        </div>
      </div>
    </div>
  )
}

function CommentSheet({ post, onClose }) {
  const comments = useComments(post.id)
  const inputId = useId()
  useOverlay(onClose) // Escape menutup lembar ini dulu, baru penampilnya

  return (
    <div className="absolute inset-0 z-10 flex items-end">
      <button tabIndex={-1} aria-label="Tutup komentar" onClick={onClose} className="absolute inset-0 animate-fade-in cursor-default bg-black/45" />
      <section
        role="dialog"
        aria-label="Komentar"
        className="viewer-panel relative flex max-h-[85dvh] min-h-[50dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-3xl"
      >
        <header className="relative flex h-12 shrink-0 items-center justify-center">
          <span className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-900/15" aria-hidden="true" />
          <h2 className="font-extrabold text-slate-800">Komentar</h2>
          <button
            onClick={onClose}
            className="absolute right-3 flex size-8 items-center justify-center rounded-full bg-slate-900/[0.06] text-slate-600 hover:bg-slate-900/10"
            aria-label="Tutup komentar"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <CommentList post={post} comments={comments} />
        </div>
        {comments.isSuccess && (
          <div className="shrink-0 border-t border-slate-900/[0.07] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <CommentFooter post={post} data={comments.data} inputId={inputId} />
          </div>
        )}
      </section>
    </div>
  )
}
