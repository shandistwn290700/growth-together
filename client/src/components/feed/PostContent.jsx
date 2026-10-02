import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { useMe } from '../../lib/auth.js'
import { audienceLabel, authorName, fullDate, timeAgo } from '../../lib/format.js'
import { removePost } from '../../lib/feedCache.js'
import { confirmDeletePost, notify, showError } from '../../lib/alert.js'
import { Ellipsis, Megaphone, MessageCircle } from 'lucide-react'
import { Avatar } from '../ui.jsx'
import MediaGrid from './MediaGrid.jsx'
import { ReactionButton, ReactionSummary } from './Reactions.jsx'

const ROLE_BADGE = { teacher: 'Guru', admin: 'Admin' }

// "bersama Ahmad dan Aisyah" (nama bisa diklik ke profil) / "bersama 25 siswa"
function TaggedLine({ post }) {
  const students = post.students
  if (students.length === 0 || post.author.role === 'parent') return null
  if (students.length > 3) return <span className="text-slate-600"> bersama {students.length} siswa</span>

  return (
    <span className="text-slate-600">
      {' bersama '}
      {students.map((s, i) => (
        <Fragment key={s.id}>
          {i > 0 && (i === students.length - 1 ? ' dan ' : ', ')}
          <Link to={`/siswa/${s.id}`} className="font-semibold text-slate-800 hover:underline">
            {s.nickname || s.fullName}
          </Link>
        </Fragment>
      ))}
    </span>
  )
}

// Isi satu postingan: dipakai di kartu feed, jendela komentar, dan panel penampil foto.
// onEdit hanya diberikan di kartu feed (menu ⋯ tidak ditampilkan di tempat lain).
// hideMedia: foto/video tidak ditampilkan (di penampil foto, medianya sudah tampil besar di sebelah).
export default function PostContent({ post, onComments, onEdit, hideMedia = false }) {
  const { data: me } = useMe()
  const isStaff = me.role !== 'parent'

  return (
    <>
      {post.audience && (
        <div
          className="flex items-center gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2 text-xs font-bold text-brand-800"
          title={post.audience.classes.map((c) => c.label).join(', ')}
        >
          <Megaphone className="size-4 shrink-0" strokeWidth={2.2} />
          <span className="truncate">Pengumuman · {audienceLabel(post.audience)}</span>
        </div>
      )}
      <header className="flex items-start gap-3 px-4 pt-4">
        <Avatar name={post.author.displayName} src={post.author.avatarUrl} />
        <div className="min-w-0 flex-1 leading-snug">
          <p className="text-sm">
            <span className="font-bold">{authorName(post.author)}</span>
            {ROLE_BADGE[post.author.role] && (
              <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-bold text-brand-700">
                {ROLE_BADGE[post.author.role]}
              </span>
            )}
            <TaggedLine post={post} />
          </p>
          <p className="text-xs text-slate-500">
            <time dateTime={post.createdAt} title={fullDate(post.createdAt)}>
              {timeAgo(post.createdAt)}
            </time>
            {post.classroom && !post.audience && ` · ${post.classroom.label}`}
            {post.updatedAt !== post.createdAt && ' · diedit'}
          </p>
        </div>
        {onEdit && (post.canEdit || post.canDelete) && <PostMenu post={post} onEdit={onEdit} />}
      </header>

      <div className="px-4 py-3">{post.caption && <p className="break-words whitespace-pre-line">{post.caption}</p>}</div>

      {!hideMedia && <MediaGrid post={post} />}

      <div className="flex items-center justify-between px-4 py-2">
        <ReactionSummary post={post} canSeeNames={isStaff} />
        {post.commentCount > 0 && (
          <button onClick={onComments} className="text-sm text-slate-500 hover:underline">
            {post.commentCount} komentar
          </button>
        )}
      </div>

      <div className="mx-4 flex border-t border-slate-900/[0.07] py-1">
        <ReactionButton post={post} />
        <button
          onClick={onComments}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold text-slate-600 hover:bg-slate-900/5"
        >
          <MessageCircle className="size-5 text-brand-600" strokeWidth={2.2} /> Komentar
        </button>
      </div>
    </>
  )
}

function PostMenu({ post, onEdit }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const remove = useMutation({
    mutationFn: () => api.delete(`/posts/${post.id}`),
    onSuccess: () => {
      removePost(queryClient, post.id)
      notify('Postingan dihapus')
    },
    onError: (err) => showError(getErrorMessage(err), 'Postingan gagal dihapus'),
  })

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        aria-label="Menu postingan"
        aria-expanded={open}
      >
        <Ellipsis className="size-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {post.canEdit && (
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onEdit()
              }}
              className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
            >
              Edit caption
            </button>
          )}
          {post.canDelete && (
            <button
              role="menuitem"
              disabled={remove.isPending}
              onClick={async () => {
                setOpen(false)
                if (await confirmDeletePost()) remove.mutate()
              }}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Hapus postingan
            </button>
          )}
        </div>
      )}
    </div>
  )
}
