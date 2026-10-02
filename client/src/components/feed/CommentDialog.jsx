import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { useMe } from '../../lib/auth.js'
import { authorName, timeAgo, fullDate } from '../../lib/format.js'
import { updatePost } from '../../lib/feedCache.js'
import { useComments } from '../../lib/queries.js'
import { confirmAction, notify, showError } from '../../lib/alert.js'
import { Lock, SendHorizontal } from 'lucide-react'
import { Alert, Avatar, Select, Spinner } from '../ui.jsx'
import GlassDialog from '../GlassDialog.jsx'
import PostContent from './PostContent.jsx'

// Di HP keyboard tidak langsung dibuka, agar postingan sempat terbaca dulu.
const isWideScreen = () => window.matchMedia('(min-width: 640px)').matches

// Jendela kaca berisi postingan & komentarnya, kolom komentar menempel di bawah (seperti Facebook).
// Komentar dikelompokkan per siswa. Orang tua hanya melihat utas anaknya; guru/admin melihat semua utas.
export default function CommentDialog({ post, onClose }) {
  const comments = useComments(post.id)
  const inputId = `komentar-${post.id}`
  const [autoFocus] = useState(isWideScreen)

  return (
    <GlassDialog
      title={`Postingan ${authorName(post.author)}`}
      size="lg"
      onClose={onClose}
      footer={comments.isSuccess ? <CommentFooter post={post} data={comments.data} inputId={inputId} autoFocus={autoFocus} /> : null}
    >
      <PostContent post={post} onComments={() => document.getElementById(inputId)?.focus()} />
      <CommentList post={post} comments={comments} />
    </GlassDialog>
  )
}

// Bagian-bagian di bawah juga dipakai penampil foto/video (MediaViewer).

// Kolom komentar yang menempel di bawah. Pengumuman menandai banyak siswa sekaligus dan komentar
// orang tua bersifat pribadi per anak, jadi guru/admin cukup membalas di bawah komentar masing-masing.
export function CommentFooter({ post, data, inputId, autoFocus = false }) {
  const { data: me } = useMe()
  if (post.audience && me.role !== 'parent') {
    return <p className="text-center text-sm text-slate-600">Komentar orang tua bersifat pribadi. Balas di bawah komentar masing-masing.</p>
  }
  return (
    <>
      {post.audience && (
        <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-slate-600">
          <Lock className="size-3.5" /> Komentar Anda hanya terlihat oleh guru & admin
        </p>
      )}
      <CommentForm post={post} students={data.students} inputId={inputId} autoFocus={autoFocus} />
    </>
  )
}

export function CommentList({ post, comments }) {
  const { data: me } = useMe()
  const threads = comments.data?.threads ?? []
  const multiThread = comments.data?.students.length > 1

  return (
    <div className="space-y-4 border-t border-slate-900/[0.07] px-4 py-3">
      {comments.isPending && <Spinner />}
      {comments.isError && <Alert>{getErrorMessage(comments.error)}</Alert>}
      {comments.isSuccess && threads.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-600">
          {post.audience ? 'Belum ada komentar.' : 'Belum ada komentar. Jadilah yang pertama memberi semangat!'}
        </p>
      )}
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
    </div>
  )
}

function CommentItem({ comment, post, me, studentId }) {
  const [replying, setReplying] = useState(false)
  return (
    <div>
      <CommentBubble comment={comment} post={post} me={me} onReply={() => setReplying(!replying)} />
      {(comment.replies.length > 0 || replying) && (
        <div className="mt-2 ml-10 space-y-2 border-l-2 border-slate-900/[0.07] pl-3">
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

const commenterName = (author) => (author.role === 'parent' ? `Ortu ${author.displayName}` : author.displayName)

function CommentBubble({ comment, post, me, onReply }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.delete(`/comments/${comment.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] })
      const removed = 1 + (comment.replies?.length ?? 0)
      updatePost(queryClient, post.id, (p) => ({ commentCount: Math.max(0, p.commentCount - removed) }))
      notify('Komentar dihapus')
    },
    onError: (err) => showError(getErrorMessage(err), 'Komentar gagal dihapus'),
  })
  const confirmRemove = async () => {
    const replies = comment.replies?.length ?? 0
    const ok = await confirmAction({
      title: 'Hapus komentar ini?',
      text: replies ? `${replies} balasan di bawahnya juga akan terhapus.` : 'Komentar yang dihapus tidak bisa dikembalikan.',
      confirmText: 'Hapus',
      tone: 'danger',
    })
    if (ok) remove.mutate()
  }
  const canDelete = comment.author.id === me.id || me.role === 'admin'

  return (
    <div className="flex gap-2">
      <Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size="sm" />
      <div className="min-w-0">
        <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-slate-900/[0.04]">
          <div className="text-sm font-bold">
            {commenterName(comment.author)}
            {comment.author.role !== 'parent' && (
              <span className="ml-1 text-xs font-semibold text-brand-700">{comment.author.role === 'admin' ? 'Admin' : 'Guru'}</span>
            )}
          </div>
          <p className="text-sm break-words whitespace-pre-line">{comment.content}</p>
        </div>
        <div className="mt-0.5 flex gap-3 px-3 text-xs text-slate-600">
          <time dateTime={comment.createdAt} title={fullDate(comment.createdAt)}>
            {timeAgo(comment.createdAt)}
          </time>
          <button onClick={onReply} className="font-bold hover:underline">
            Balas
          </button>
          {canDelete && (
            <button
              onClick={confirmRemove}
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

function CommentForm({ post, students, fixedStudentId, parentId, placeholder, onDone, autoFocus, inputId }) {
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
          {/* Kolom komentar dan tombol kirim selalu satu baris, juga di HP */}
          <div className="glass-field flex min-w-0 flex-1 items-center rounded-full pr-1 focus-within:ring-2 focus-within:ring-brand-200">
            <input
              id={inputId}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder ?? 'Tulis komentar…'}
              aria-label={placeholder ?? 'Tulis komentar'}
              maxLength={2000}
              autoFocus={autoFocus}
              className="min-w-0 flex-1 bg-transparent py-2 pl-4 text-base outline-none placeholder:text-slate-500 sm:text-sm"
            />
            <button
              type="submit"
              disabled={!content.trim() || send.isPending || (needsPicker && !studentId)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50 disabled:text-slate-400 disabled:hover:bg-transparent"
              aria-label="Kirim komentar"
            >
              <SendHorizontal className="size-[18px]" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
      {send.isError && <Alert>{getErrorMessage(send.error)}</Alert>}
    </form>
  )
}
