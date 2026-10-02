import { useCallback, useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, Heart, Image as ImageIcon, MessageCircle, Play, Search, Trash2 } from 'lucide-react'
import api, { getErrorMessage } from '../../lib/api.js'
import { classLabel, useClassrooms } from '../../lib/queries.js'
import { removePost } from '../../lib/feedCache.js'
import { formatNumber } from '../../lib/format.js'
import { Alert, Button, Select, Spinner } from '../../components/ui.jsx'
import { Modal, PageHeader, Panel } from '../../components/admin/AdminUI.jsx'
import PostCard from '../../components/feed/PostCard.jsx'

const ROLE = { teacher: 'Guru', parent: 'Orang tua', admin: 'Admin' }
const fullDate = (v) => new Date(v).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function Thumbnail({ post }) {
  const first = post.media[0]
  if (!first) {
    return (
      <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <ImageIcon className="size-5" />
      </span>
    )
  }
  return (
    <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-slate-200">
      <img src={first.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
      {first.type === 'video' && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="size-5 fill-white text-white" />
        </span>
      )}
      {post.media.length > 1 && (
        <span className="absolute right-0.5 bottom-0.5 rounded bg-black/60 px-1 text-[10px] font-bold text-white">+{post.media.length - 1}</span>
      )}
    </span>
  )
}

export default function ModerationPage() {
  const queryClient = useQueryClient()
  const classrooms = useClassrooms()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [classroomId, setClassroomId] = useState('')
  const [viewingId, setViewingId] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Key berawalan 'posts' agar edit/hapus/reaksi dari PostCard ikut memperbarui daftar ini.
  const posts = useInfiniteQuery({
    queryKey: ['posts', 'moderation', { search, classroomId }],
    queryFn: ({ pageParam }) =>
      api.get('/admin/posts', { params: { cursor: pageParam, search, classroomId: classroomId || undefined } }).then((r) => r.data),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
  const items = posts.data?.pages.flatMap((p) => p.items) ?? []
  // Jika postingan yang sedang dibuka dihapus, modal otomatis tertutup karena datanya hilang dari daftar.
  const viewing = items.find((p) => p.id === viewingId)
  const closeModal = useCallback(() => setViewingId(null), [])

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/posts/${id}`),
    onSuccess: (_, id) => removePost(queryClient, id),
  })
  const confirmRemove = (post) =>
    window.confirm('Hapus postingan ini beserta foto/videonya? Tindakan ini tidak bisa dibatalkan.') && remove.mutate(post.id)

  return (
    <>
      <PageHeader title="Moderasi Postingan" description="Semua postingan dari guru, orang tua, dan admin — terbaru di atas." />
      {remove.isError && <Alert>{getErrorMessage(remove.error)}</Alert>}

      <Panel bodyClassName="p-0">
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-[1fr_16rem] sm:p-4">
          <label className="relative">
            <span className="sr-only">Cari caption</span>
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari isi caption…"
              className="w-full rounded-lg border border-slate-300 py-2.5 pr-3 pl-9 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
            />
          </label>
          <Select value={classroomId} onChange={(e) => setClassroomId(e.target.value)} aria-label="Filter kelas">
            <option value="">Semua kelas</option>
            {(classrooms.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c)}
              </option>
            ))}
          </Select>
        </div>

        {posts.isPending ? (
          <Spinner />
        ) : posts.isError ? (
          <div className="p-4">
            <Alert>{getErrorMessage(posts.error)}</Alert>
          </div>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Tidak ada postingan yang cocok.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((post) => (
              <li key={post.id} className="flex gap-3 px-4 py-3 sm:px-5">
                <Thumbnail post={post} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-slate-800">{post.caption || <i className="text-slate-400">(tanpa caption)</i>}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>
                      <b className="font-semibold text-slate-700">{post.author.role === 'parent' ? `Ortu ${post.author.displayName}` : post.author.displayName}</b>{' '}
                      · {ROLE[post.author.role]}
                    </span>
                    <span>{post.classroom?.label ?? `${post.totalTagged} siswa ditandai`}</span>
                    <span>{fullDate(post.createdAt)}</span>
                    <span className="flex items-center gap-1" title="Reaksi">
                      <Heart className="size-3.5" /> {formatNumber(post.reactions.total)}
                    </span>
                    <span className="flex items-center gap-1" title="Komentar">
                      <MessageCircle className="size-3.5" /> {formatNumber(post.commentCount)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
                  <button
                    onClick={() => setViewingId(post.id)}
                    className="flex size-9 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50"
                    aria-label="Lihat postingan"
                    title="Lihat"
                  >
                    <Eye className="size-[18px]" />
                  </button>
                  <button
                    onClick={() => confirmRemove(post)}
                    disabled={remove.isPending}
                    className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                    aria-label="Hapus postingan"
                    title="Hapus"
                  >
                    <Trash2 className="size-[18px]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {posts.hasNextPage && (
          <div className="border-t border-slate-100 p-3 text-center">
            <Button variant="secondary" onClick={() => posts.fetchNextPage()} disabled={posts.isFetchingNextPage}>
              {posts.isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}
            </Button>
          </div>
        )}
      </Panel>

      {viewing && (
        <Modal title="Detail postingan" onClose={closeModal}>
          <PostCard post={viewing} />
        </Modal>
      )}
    </>
  )
}
