import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { useMe } from '../../lib/auth.js'
import { fullDate, timeAgo } from '../../lib/format.js'
import { removePost, updatePost } from '../../lib/feedCache.js'
import { Alert, Avatar, Button } from '../ui.jsx'
import MediaGrid from './MediaGrid.jsx'
import CommentSection from './CommentSection.jsx'
import { ReactionButton, ReactionSummary } from './Reactions.jsx'

const ROLE_BADGE = { teacher: 'Guru', admin: 'Admin' }

function authorName(author) {
  return author.role === 'parent' ? `Orang tua ${author.displayName}` : author.displayName
}

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

export default function PostCard({ post }) {
  const { data: me } = useMe()
  const [showComments, setShowComments] = useState(false)
  const [editing, setEditing] = useState(false)
  const isStaff = me.role !== 'parent'

  return (
    <article className="overflow-hidden rounded-xl bg-white shadow-sm">
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
            {post.classroom && ` Â· ${post.classroom.label}`}
            {post.updatedAt !== post.createdAt && ' Â· diedit'}
          </p>
        </div>
        {(post.canEdit || post.canDelete) && <PostMenu post={post} onEdit={() => setEditing(true)} />}
      </header>

      <div className="px-4 py-3">
        {editing ? (
          <EditCaption post={post} onDone={() => setEditing(false)} />
        ) : (
          post.caption && <p className="break-words whitespace-pre-line">{post.caption}</p>
        )}
      </div>

      <MediaGrid media={post.media} />

      <div className="flex items-center justify-between px-4 py-2">
        <ReactionSummary post={post} canSeeNames={isStaff} />
        {post.commentCount > 0 && (
          <button onClick={() => setShowComments(true)} className="text-sm text-slate-500 hover:underline">
            {post.commentCount} komentar
          </button>
        )}
      </div>

      <div className="mx-4 flex border-t border-slate-100 py-1">
        <ReactionButton post={post} />
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
          aria-expanded={showComments}
        >
          ðŸ’¬ Komentar
        </button>
      </div>

      {showComments && <CommentSection post={post} />}
    </article>
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
    onSuccess: () => removePost(queryClient, post.id),
    onError: (err) => window.alert(getErrorMessage(err)),
  })

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100"
        aria-label="Menu postingan"
        aria-expanded={open}
      >
        â‹¯
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
              onClick={() => {
                setOpen(false)
                if (window.confirm('Hapus postingan ini beserta foto/videonya? Tindakan ini tidak bisa dibatalkan.')) remove.mutate()
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

function EditCaption({ post, onDone }) {
  const queryClient = useQueryClient()
  const [caption, setCaption] = useState(post.caption ?? '')
  const save = useMutation({
    mutationFn: () => api.patch(`/posts/${post.id}`, { caption }).then((r) => r.data),
    onSuccess: (updated) => {
      updatePost(queryClient, post.id, () => ({ caption: updated.caption, updatedAt: updated.updatedAt }))
      onDone()
    },
  })

  return (
    <div className="space-y-2">
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={3}
        maxLength={5000}
        autoFocus
        className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
      {save.isError && <Alert>{getErrorMessage(save.error)}</Alert>}
      <div className="flex gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Simpan
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Batal
        </Button>
      </div>
    </div>
  )
}
