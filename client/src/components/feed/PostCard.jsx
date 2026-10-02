import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { updatePost } from '../../lib/feedCache.js'
import { authorName } from '../../lib/format.js'
import { Alert, Avatar, Button } from '../ui.jsx'
import GlassDialog from '../GlassDialog.jsx'
import PostContent from './PostContent.jsx'
import CommentDialog from './CommentDialog.jsx'

export default function PostCard({ post }) {
  const [dialog, setDialog] = useState(null) // null | 'comments' | 'edit'
  const close = () => setDialog(null)

  return (
    <article className="overflow-hidden rounded-xl bg-white shadow-sm">
      <PostContent post={post} onComments={() => setDialog('comments')} onEdit={() => setDialog('edit')} />
      {dialog === 'comments' && <CommentDialog post={post} onClose={close} />}
      {dialog === 'edit' && <EditDialog post={post} onClose={close} />}
    </article>
  )
}

function EditDialog({ post, onClose }) {
  const queryClient = useQueryClient()
  const dialog = useRef(null)
  const original = post.caption ?? ''
  const [caption, setCaption] = useState(original)
  const save = useMutation({
    mutationFn: () => api.patch(`/posts/${post.id}`, { caption }).then((r) => r.data),
    onSuccess: (updated) => {
      updatePost(queryClient, post.id, () => ({ caption: updated.caption, updatedAt: updated.updatedAt }))
      dialog.current.close()
    },
  })
  const changed = caption !== original

  return (
    <GlassDialog
      ref={dialog}
      title="Edit postingan"
      onClose={onClose}
      locked={save.isPending}
      confirmClose={changed ? 'Batalkan perubahan caption?' : null}
      footer={
        <Button onClick={() => save.mutate()} disabled={!changed || save.isPending} className="w-full py-2.5 text-base">
          {save.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      }
    >
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={post.author.displayName} src={post.author.avatarUrl} />
          <div className="font-bold">{authorName(post.author)}</div>
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
          rows={6}
          maxLength={5000}
          autoFocus
          aria-label="Caption"
          className="glass-field w-full resize-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-brand-200"
        />
        {post.media.length > 0 && (
          <p className="text-xs text-slate-600">Foto/video tidak bisa diganti. Jika perlu, hapus postingan lalu buat yang baru.</p>
        )}
        {save.isError && <Alert>{getErrorMessage(save.error)}</Alert>}
      </div>
    </GlassDialog>
  )
}
