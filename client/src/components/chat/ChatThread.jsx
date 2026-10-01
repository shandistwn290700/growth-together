import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { useMe } from '../../lib/auth.js'
import { encryptFor } from '../../lib/chatSession.js'
import { getSocket } from '../../lib/socket.js'
import { Alert, Spinner } from '../ui.jsx'
import { addMessageToCache, counterpartName, messagesKey, useChat, useConversations, useLocalKey } from './chatState.js'
import { OnlineAvatar } from './ConversationList.jsx'
import { useDecrypted } from './useDecrypted.js'

const MAX_LENGTH = 4000

function dayLabel(value) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Hari ini'
  if (date.toDateString() === yesterday.toDateString()) return 'Kemarin'
  return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const clock = (value) => new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

export default function ChatThread({ conversationId }) {
  const id = Number(conversationId)
  const { data: me } = useMe()
  const { typing } = useChat()
  const conversations = useConversations()
  const conversation = conversations.data?.find((c) => c.id === id)

  const messages = useInfiniteQuery({
    queryKey: messagesKey(id),
    queryFn: ({ pageParam }) => api.get(`/conversations/${id}/messages`, { params: { before: pageParam } }).then((r) => r.data),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
  })
  // API mengirim terbaru dulu; untuk tampilan chat dibalik (terlama di atas).
  const items = useMemo(() => (messages.data?.pages.flatMap((p) => p.items) ?? []).slice().reverse(), [messages.data])
  const texts = useDecrypted(items)

  useMarkRead(id, items, me.id)
  const { scroller, bottom, onScroll, scrollToBottomNext } = useChatScroll(messages, items.length)

  if (conversations.isPending || messages.isPending) return <Spinner />
  if (!conversation || messages.isError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Alert>{messages.isError ? getErrorMessage(messages.error) : 'Percakapan tidak ditemukan'}</Alert>
      </div>
    )
  }

  const person = conversation.counterpart
  const isTyping = Boolean(typing[id])

  return (
    <div className="flex min-h-0 w-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5">
        <Link to="/chat" className="rounded-full px-2 py-1 text-xl text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Kembali">
          ←
        </Link>
        <OnlineAvatar person={person} />
        <div className="min-w-0">
          <div className="truncate font-bold">{counterpartName(person)}</div>
          <div className={`truncate text-xs ${isTyping || person.online ? 'text-brand-700' : 'text-slate-500'}`}>
            {isTyping ? 'sedang mengetik…' : person.online ? 'Online' : person.subtitle}
          </div>
        </div>
      </header>

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-slate-50 px-3 py-4">
        {messages.isFetchingNextPage && <Spinner label="Memuat pesan lama…" />}
        {!messages.hasNextPage && (
          <p className="mx-auto mb-4 max-w-sm rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
            🔒 Pesan di percakapan ini terenkripsi end-to-end. Hanya Anda dan {counterpartName(person)} yang bisa membacanya,
            pihak sekolah pun tidak.
          </p>
        )}
        {items.map((m, i) => {
          const mine = m.senderId === me.id
          const result = texts[m.id]
          const newDay = i === 0 || new Date(items[i - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString()
          return (
            <Fragment key={m.id}>
              {newDay && (
                <div className="py-2 text-center">
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">{dayLabel(m.createdAt)}</span>
                </div>
              )}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 shadow-sm ${
                    mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-slate-800'
                  }`}
                >
                  <p className="break-words whitespace-pre-wrap">
                    {result?.locked ? (
                      <i className="opacity-80">🔒 Pesan ini tidak bisa dibuka (dikirim sebelum kunci chat diganti)</i>
                    ) : (
                      (result?.text ?? '…')
                    )}
                  </p>
                  <div className={`mt-0.5 text-right text-[11px] ${mine ? 'text-brand-100' : 'text-slate-400'}`}>
                    {clock(m.createdAt)}
                    {mine && (
                      <span className={`ml-1 ${m.readAt ? 'font-bold text-sky-200' : ''}`} title={m.readAt ? 'Sudah dibaca' : 'Terkirim'}>
                        {m.readAt ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Fragment>
          )
        })}
        <div ref={bottom} />
      </div>

      <Composer conversation={conversation} onSent={scrollToBottomNext} />
    </div>
  )
}

// Tandai pesan masuk sebagai sudah dibaca saat percakapan terbuka dan tab sedang dilihat.
function useMarkRead(conversationId, items, myId) {
  const queryClient = useQueryClient()
  const lastUnreadId = items.findLast((m) => m.senderId !== myId && !m.readAt)?.id
  const [visible, setVisible] = useState(!document.hidden)

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  useEffect(() => {
    if (!lastUnreadId || !visible) return
    api.post(`/conversations/${conversationId}/read`).then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
    })
  }, [conversationId, lastUnreadId, visible, queryClient])
}

// Scroll: tetap di bawah saat ada pesan baru, muat pesan lama saat digulir ke atas tanpa melompat.
function useChatScroll(messages, count) {
  const scroller = useRef(null)
  const bottom = useRef(null)
  const stickToBottom = useRef(true)
  const restoreFrom = useRef(null)

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (restoreFrom.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFrom.current
      restoreFrom.current = null
    } else if (stickToBottom.current) {
      bottom.current?.scrollIntoView({ block: 'end' })
    }
  }, [count])

  const onScroll = () => {
    const el = scroller.current
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (el.scrollTop < 60 && messages.hasNextPage && !messages.isFetchingNextPage) {
      restoreFrom.current = el.scrollHeight - el.scrollTop
      messages.fetchNextPage()
    }
  }

  // Setelah mengirim pesan, selalu gulir ke pesan terbaru.
  const scrollToBottomNext = () => {
    stickToBottom.current = true
  }

  return { scroller, bottom, onScroll, scrollToBottomNext }
}

function Composer({ conversation, onSent }) {
  const { data: me } = useMe()
  const local = useLocalKey()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const lastTypingSent = useRef(0)
  const stopTimer = useRef(null)
  const person = conversation.counterpart

  const send = useMutation({
    mutationFn: async (plain) => {
      const payload = await encryptFor(local, person.activeKey, plain, me.id)
      const { data } = await api.post(`/conversations/${conversation.id}/messages`, payload)
      return data
    },
    onSuccess: (message) => {
      addMessageToCache(queryClient, message)
      onSent()
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    // 409: kunci lawan bicara berubah. Muat ulang daftar percakapan untuk kunci terbaru.
    onError: (err) => err.response?.status === 409 && queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  })

  const setTyping = (isTyping) => getSocket()?.emit('typing', { conversationId: conversation.id, isTyping })

  const onChange = (e) => {
    setText(e.target.value)
    // Kirim sinyal "mengetik" paling sering tiap 3 detik, dan "berhenti" setelah 2,5 detik diam.
    if (Date.now() - lastTypingSent.current > 3000) {
      setTyping(true)
      lastTypingSent.current = Date.now()
    }
    clearTimeout(stopTimer.current)
    stopTimer.current = setTimeout(() => {
      setTyping(false)
      lastTypingSent.current = 0
    }, 2500)
  }

  const submit = () => {
    const plain = text.trim()
    if (!plain || send.isPending) return
    setText('')
    clearTimeout(stopTimer.current)
    setTyping(false)
    lastTypingSent.current = 0
    send.mutate(plain, { onError: () => setText(plain) })
  }

  if (!conversation.canSend) {
    return (
      <p className="border-t border-slate-100 px-4 py-3 text-center text-sm text-slate-500">
        Percakapan ini hanya bisa dibaca karena ananda sudah tidak berada di kelas tersebut.
      </p>
    )
  }
  if (!person.activeKey) {
    return (
      <p className="border-t border-slate-100 px-4 py-3 text-center text-sm text-slate-500">
        {counterpartName(person)} belum mengaktifkan chat. Pesan bisa dikirim setelah beliau login ke aplikasi.
      </p>
    )
  }

  return (
    <div className="border-t border-slate-100 p-2">
      {send.isError && (
        <div className="mb-2">
          <Alert>
            {send.error.response?.status === 409 ? 'Kunci enkripsi lawan bicara berubah. Silakan kirim ulang.' : getErrorMessage(send.error)}
          </Alert>
        </div>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <textarea
          value={text}
          onChange={onChange}
          onKeyDown={(e) => {
            // Enter = kirim, Shift+Enter = baris baru (di laptop). Di HP pakai tombol kirim.
            if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(hover: hover)').matches) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          maxLength={MAX_LENGTH}
          placeholder="Tulis pesan…"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-slate-100 px-4 py-2 outline-none focus:ring-2 focus:ring-brand-100 [field-sizing:content]"
        />
        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300"
          aria-label="Kirim"
        >
          ➤
        </button>
      </form>
    </div>
  )
}
