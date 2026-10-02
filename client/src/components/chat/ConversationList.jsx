import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import api, { getErrorMessage } from '../../lib/api.js'
import { useMe } from '../../lib/auth.js'
import { Alert, Avatar, Spinner } from '../ui.jsx'
import { counterpartName, useChat, useChatContacts, useConversations } from './chatState.js'
import { useDecrypted } from './useDecrypted.js'

export function OnlineAvatar({ person, size = 'md' }) {
  return (
    <div className="relative shrink-0">
      <Avatar name={person.displayName} src={person.avatarUrl} size={size} />
      {person.online && (
        <span className="absolute right-0 bottom-0 size-3 rounded-full bg-green-500 ring-2 ring-white" title="Online" />
      )}
    </div>
  )
}

function shortTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

// onSelect (opsional): dipanggil saat percakapan dipilih, misalnya untuk membuka jendela mini.
// Tanpa onSelect, setiap percakapan adalah link ke halaman chat.
export default function ConversationList({ activeId, onSelect }) {
  const { data: me } = useMe()
  const { typing } = useChat()
  const conversations = useConversations()
  const [picking, setPicking] = useState(false)
  const list = conversations.data ?? []
  const previews = useDecrypted(list.map((c) => c.lastMessage))

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h1 className="text-xl font-extrabold">Chat</h1>
        <button
          onClick={() => setPicking(!picking)}
          className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700 hover:bg-brand-100"
        >
          {picking ? 'Tutup' : '+ Chat baru'}
        </button>
      </div>

      {picking ? (
        <ContactPicker onPicked={() => setPicking(false)} onSelect={onSelect} />
      ) : conversations.isPending ? (
        <Spinner />
      ) : conversations.isError ? (
        <div className="p-4">
          <Alert>{getErrorMessage(conversations.error)}</Alert>
        </div>
      ) : list.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">
          Belum ada percakapan. Klik <b>+ Chat baru</b> untuk mulai mengobrol dengan{' '}
          {me.role === 'parent' ? 'wali kelas ananda' : 'orang tua siswa'}.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {list.map((c) => {
            const last = c.lastMessage
            const preview = last && previews[last.id]
            const isTyping = Boolean(typing[c.id])
            const rowClass = `flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${
              Number(activeId) === c.id ? 'bg-brand-50' : ''
            }`
            const wrap = (children) =>
              onSelect ? (
                <button onClick={() => onSelect(c.id)} className={rowClass}>
                  {children}
                </button>
              ) : (
                <Link to={`/chat/${c.id}`} className={rowClass}>
                  {children}
                </Link>
              )
            return (
              <li key={c.id}>
                {wrap(
                  <>
                  <OnlineAvatar person={c.counterpart} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${c.unreadCount ? 'font-extrabold' : 'font-semibold'}`}>{counterpartName(c.counterpart)}</span>
                      <span className="shrink-0 text-xs text-slate-500">{shortTime(last?.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${c.unreadCount ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                        {isTyping ? (
                          <i className="text-brand-700">sedang mengetik…</i>
                        ) : !last ? (
                          <i>{c.counterpart.subtitle || 'Belum ada pesan'}</i>
                        ) : (
                          <>
                            {last.senderId === me.id && 'Anda: '}
                            {preview?.locked ? (
                              <>
                                <Lock className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
                                Pesan terkunci
                              </>
                            ) : (
                              (preview?.text ?? '…')
                            )}
                          </>
                        )}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  </>,
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ContactPicker({ onPicked, onSelect }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const contacts = useChatContacts()

  const go = (conversationId) => {
    onPicked()
    if (onSelect) onSelect(conversationId)
    else navigate(`/chat/${conversationId}`)
  }

  const open = useMutation({
    mutationFn: (userId) => api.post('/conversations', { userId }).then((r) => r.data),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['chat-contacts'] })
      go(conversation.id)
    },
  })

  const term = search.trim().toLowerCase()
  const filtered = (contacts.data ?? []).filter(
    (c) => !term || c.displayName.toLowerCase().includes(term) || c.subtitle.toLowerCase().includes(term),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama…"
          autoFocus
          className="w-full rounded-full bg-slate-100 px-4 py-2 text-base outline-none focus:ring-2 focus:ring-brand-100 sm:text-sm"
        />
      </div>
      {open.isError && (
        <div className="px-3">
          <Alert>{getErrorMessage(open.error)}</Alert>
        </div>
      )}
      {contacts.isPending ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">
          {contacts.data?.length ? 'Tidak ada yang cocok.' : 'Belum ada kontak. Kontak muncul dari kelas di tahun ajaran aktif.'}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => (c.conversationId ? go(c.conversationId) : open.mutate(c.id))}
                disabled={open.isPending}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
              >
                <OnlineAvatar person={c} size="sm" />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{counterpartName(c)}</div>
                  <div className="truncate text-xs text-slate-500">{c.subtitle}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
