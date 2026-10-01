import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { useMe } from '../../lib/auth.js'
import { timeAgo, fullDate } from '../../lib/format.js'
import { updatePost } from '../../lib/feedCache.js'
import { Alert, Avatar, Select, Spinner } from '../ui.jsx'

// Komentar dikelompokkan per siswa. Orang tua hanya melihat utas anaknya; guru/admin melihat semua utas.
export default function CommentSection({ post }) {
  const { data: me } = useMe()
  const comments = useQuery({
    queryKey: ['comments', post.id],
    queryFn: () => api.get(`/posts/${post.id}/comments`).then((r) => r.data),
  })

  if (comments.isPending) return <Spinner />
  if (comments.isError) return <Alert>{getErrorMessage(comments.error)}</Alert>

  const { students, threads } = comments.data
  const multiThread = students.length > 1

  return (
    <div className="space-y-4 border-t border-slate-100 px-4 py-3">
      {threads.length === 0 && <p className="text-sm text-slate-500">Belum ada komentar.</p>}
      {threads.map((thread) => (
        <section key={thread.student.id} className="space-y-2">
          {multiThread && (
            <h4 className="text-xs font-bold tracking-wide text-brand-700 uppercase">Tentang {thread.student.fullName}</h4>
          )}
          {thread.comments.map((c) => (
            <CommentItem key={c.id} comment={c} post={post} me={me} studentId={thread.student.id} />
          ))}
        </section>
      ))}
      <CommentForm post={post} students={students} />
    </div>
  )
}

function CommentItem({ comment, post, me, studentId }) {
  const [replying, setReplying] = useState(false)
  return (
    <div>
      <CommentBubble comment={comment} post={post} me={me} onReply={() => setReplying(!replying)} />
      {(comment.replies.length > 0 || replying) && (
        <div className="mt-2 ml-10 space-y-2 border-l-2 border-slate-100 pl-3">
          {comment.replies.map((reply) => (
            <CommentBubble key={reply.id} comment={reply} post={post} me={me} onReply={() => setReplying(true)} />
          ))}
          {replying && (
            <CommentForm
              post={post}
              fixedStudentId={studentId}
              parentId={comment.id}
              placeholder={`Balas ${comment.author.displayName}…`}
              onDone={() => setReplying(false)}
              autoFocus
            />
          )}
        </div>
      )}
    </div>
  )
}

const authorLabel = (author) => (author.role === 'parent' ? `Ortu ${author.displayName}` : author.displayName)

function CommentBubble({ comment, post, me, onReply }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.delete(`/comments/${comment.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] })
      const removed = 1 + (comment.replies?.length ?? 0)
      updatePost(queryClient, post.id, (p) => ({ commentCount: Math.max(0, p.commentCount - removed) }))
    },
  })
  const canDelete = comment.author.id === me.id || me.role === 'admin'

  return (
    <div className="flex gap-2">
      <Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size="sm" />
      <div className="min-w-0">
        <div className="rounded-2xl bg-slate-100 px-3 py-2">
          <div className="text-sm font-bold">
            {authorLabel(comment.author)}
            {comment.author.role !== 'parent' && (
              <span className="ml-1 text-xs font-semibold text-brand-700">{comment.author.role === 'admin' ? 'Admin' : 'Guru'}</span>
            )}
          </div>
          <p className="text-sm break-words whitespace-pre-line">{comment.content}</p>
        </div>
        <div className="mt-0.5 flex gap-3 px-3 text-xs text-slate-500">
          <time dateTime={comment.createdAt} title={fullDate(comment.createdAt)}>
            {timeAgo(comment.createdAt)}
          </time>
          <button onClick={onReply} className="font-bold hover:underline">
            Balas
          </button>
          {canDelete && (
            <button
              onClick={() => window.confirm('Hapus komentar ini?') && remove.mutate()}
              disabled={remove.isPending}
              className="font-bold hover:text-red-600 hover:underline"
            >
              Hapus
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CommentForm({ post, students, fixedStudentId, parentId, placeholder, onDone, autoFocus }) {
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const [content, setContent] = useState('')
  const [studentId, setStudentId] = useState('')
  const needsPicker = !fixedStudentId && students?.length > 1

  const send = useMutation({
    mutationFn: () =>
      api.post(`/posts/${post.id}/comments`, {
        content,
        parentId,
        studentId: fixedStudentId ?? (needsPicker ? Number(studentId) : students?.[0]?.id),
      }),
    onSuccess: () => {
      setContent('')
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] })
      updatePost(queryClient, post.id, (p) => ({ commentCount: p.commentCount + 1 }))
      onDone?.()
    },
  })

  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (content.trim()) send.mutate()
      }}
    >
      <div className="flex items-start gap-2">
        <Avatar name={me.displayName} src={me.avatarUrl} size="sm" />
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          {needsPicker && (
            <div className="sm:w-44">
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="Komentar tentang" required>
                <option value="">Tentang siswa…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nickname || s.fullName}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {/* Kolom komentar dan tombol Kirim selalu satu baris, juga di HP */}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder ?? 'Tulis komentar…'}
              maxLength={2000}
              autoFocus={autoFocus}
              className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-2 text-base outline-none focus:ring-2 focus:ring-brand-100 sm:text-sm"
            />
            <button
              type="submit"
              disabled={!content.trim() || send.isPending || (needsPicker && !studentId)}
              className="shrink-0 rounded-full px-3 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:text-slate-400"
            >
              Kirim
            </button>
          </div>
        </div>
      </div>
      {send.isError && <Alert>{getErrorMessage(send.error)}</Alert>}
    </form>
  )
}
