import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api.js'
import { REACTIONS, reactionOf } from '../../lib/reactions.js'
import { updatePost } from '../../lib/feedCache.js'
import { ThumbsUp, X } from 'lucide-react'
import { Avatar, Spinner } from '../ui.jsx'

// Tombol reaksi ala Facebook: klik = Suka/batal, tahan (HP) atau arahkan kursor (laptop) = pilih reaksi lain.
// variant 'overlay': tulisan putih di atas foto gelap (penampil foto/video di HP).
export function ReactionButton({ post, variant = 'default' }) {
  const overlay = variant === 'overlay'
  const queryClient = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const timer = useRef(null)
  const longPressed = useRef(false)
  const mine = reactionOf(post.reactions.mine)

  const react = useMutation({
    mutationFn: (type) =>
      (type ? api.put(`/posts/${post.id}/reaction`, { type }) : api.delete(`/posts/${post.id}/reaction`)).then((r) => r.data),
    onSuccess: (reactions) => updatePost(queryClient, post.id, () => ({ reactions })),
  })

  const choose = (type) => {
    setPickerOpen(false)
    react.mutate(type)
  }

  const startPress = () => {
    longPressed.current = false
    timer.current = setTimeout(() => {
      longPressed.current = true
      setPickerOpen(true)
    }, 450)
  }
  const endPress = () => clearTimeout(timer.current)

  return (
    <div
      className="relative flex-1"
      onMouseEnter={() => {
        // Di HP, sentuhan juga memicu mouseenter; pemilih reaksi lewat hover hanya untuk perangkat ber-mouse.
        if (window.matchMedia('(hover: hover)').matches) timer.current = setTimeout(() => setPickerOpen(true), 500)
      }}
      onMouseLeave={() => {
        clearTimeout(timer.current)
        setPickerOpen(false)
      }}
    >
      {pickerOpen && (
        <div role="menu" className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-full bg-white p-1.5 shadow-lg ring-1 ring-slate-200">
          {REACTIONS.map((r) => (
            <button
              key={r.type}
              role="menuitem"
              onClick={() => choose(r.type)}
              title={r.label}
              aria-label={r.label}
              className="text-2xl transition-transform hover:scale-125 focus:scale-125"
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
      <button
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (longPressed.current) return
          choose(mine ? null : 'like')
        }}
        onKeyDown={(e) => e.key === 'ArrowUp' && setPickerOpen(true)}
        disabled={react.isPending}
        aria-haspopup="menu"
        className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold select-none ${
          overlay ? 'text-white hover:bg-white/10' : `hover:bg-slate-100 ${mine ? mine.color : 'text-slate-600'}`
        }`}
      >
        {/* "Suka" memakai ikon jempol bertema (terisi saat dipilih); reaksi lain memakai emoji */}
        {!mine || mine.type === 'like' ? (
          <ThumbsUp
            className={`size-5 ${
              overlay ? (mine ? 'fill-brand-300 text-brand-300' : 'text-white') : mine ? 'fill-brand-600 text-brand-600' : 'text-brand-600'
            }`}
            strokeWidth={2.2}
          />
        ) : (
          <span className="text-lg leading-none">{mine.emoji}</span>
        )}
        {mine ? mine.label : 'Suka'}
      </button>
    </div>
  )
}

// Ringkasan reaksi: emoji terbanyak + jumlah. Guru/admin bisa melihat siapa saja yang bereaksi.
export function ReactionSummary({ post, canSeeNames, variant = 'default' }) {
  const overlay = variant === 'overlay'
  const [open, setOpen] = useState(false)
  const { total, counts } = post.reactions
  if (!total) return <span />

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => reactionOf(type)?.emoji)

  const content = (
    <>
      <span>{top.join('')}</span>
      <span>{total}</span>
    </>
  )

  const tone = overlay ? 'text-white/85' : 'text-slate-500'
  if (!canSeeNames) return <span className={`flex items-center gap-1 text-sm ${tone}`}>{content}</span>

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`flex items-center gap-1 text-sm hover:underline ${tone}`}>
        {content}
      </button>
      {/* Di penampil foto, ringkasan ada di bawah layar, jadi daftarnya dibuka ke atas */}
      {open && <ReactorList postId={post.id} onClose={() => setOpen(false)} above={overlay} />}
    </div>
  )
}

function ReactorList({ postId, onClose, above = false }) {
  const list = useQuery({
    queryKey: ['reactions', postId],
    queryFn: () => api.get(`/posts/${postId}/reactions`).then((r) => r.data),
  })
  return (
    <div
      className={`absolute left-0 z-10 w-64 rounded-xl bg-white p-2 text-slate-800 shadow-lg ring-1 ring-slate-200 ${
        above ? 'bottom-full mb-1' : 'top-full mt-1'
      }`}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-sm font-bold">Sudah merespons</span>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup">
          <X className="size-4" />
        </button>
      </div>
      {list.isPending ? (
        <Spinner />
      ) : (
        <ul className="max-h-60 overflow-y-auto">
          {list.data?.map((r) => (
            <li key={r.user.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
              <Avatar name={r.user.displayName} src={r.user.avatarUrl} size="sm" />
              <span className="flex-1 truncate text-sm">
                {r.user.role === 'parent' ? `Ortu ${r.user.displayName}` : r.user.displayName}
              </span>
              <span>{reactionOf(r.type)?.emoji}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
