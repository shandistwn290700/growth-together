import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Maximize2, Minus, X } from 'lucide-react'
import { Avatar } from '../ui.jsx'
import ChatThread from './ChatThread.jsx'
import { LocalKeyContext, counterpartName, useChat, useConversations } from './chatState.js'

const WINDOW_WIDTH = 328
const GAP = 8
const BUBBLE_COLUMN = 72
const MAX_OPEN = 3
const MAX_BUBBLES = 6

// Berapa jendela yang muat berdampingan di layar (maksimal 3, seperti Facebook).
function useMaxOpen() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return Math.max(1, Math.min(MAX_OPEN, Math.floor((width - BUBBLE_COLUMN - 32) / (WINDOW_WIDTH + GAP))))
}

// Jendela chat mini di pojok kanan bawah (laptop).
// Chat terbaru selalu paling kanan; jendela yang lebih lama bergeser ke kiri.
// Jika tidak muat, jendela paling lama menjadi gelembung avatar di kolom paling kanan.
export default function ChatDock() {
  const { dock, localKey } = useChat()
  const conversations = useConversations()
  const maxOpen = useMaxOpen()
  if (!dock?.available || dock.windows.length === 0) return null

  const byId = Object.fromEntries((conversations.data ?? []).map((c) => [c.id, c]))
  const expanded = dock.windows.filter((w) => !w.minimized)
  const shown = expanded.slice(-maxOpen) // yang terbaru
  const shownIds = new Set(shown.map((w) => w.id))
  const bubbles = dock.windows.filter((w) => !shownIds.has(w.id)).slice(-MAX_BUBBLES)

  return (
    <LocalKeyContext.Provider value={localKey}>
      <div className="pointer-events-none fixed right-0 bottom-0 z-40 hidden items-end gap-3 pr-4 md:flex">
        {/* flex-row-reverse: elemen pertama (terbaru) berada paling kanan */}
        <div className="flex flex-row-reverse items-end gap-2">
          {[...shown].reverse().map((w) => (
            <ChatWindow key={w.id} item={w} conversation={byId[w.id]} />
          ))}
        </div>
        {bubbles.length > 0 && (
          <div className="pointer-events-auto mb-4 flex flex-col gap-3" aria-label="Chat yang dikecilkan">
            {bubbles.map((w) => (
              <Bubble key={w.id} item={w} conversation={byId[w.id]} />
            ))}
          </div>
        )}
      </div>
    </LocalKeyContext.Provider>
  )
}

function HeaderButton({ label, onClick, children }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full text-brand-600 hover:bg-brand-50"
    >
      {children}
    </button>
  )
}

// Elemen yang ditutup tetap tampil sampai animasi keluarnya selesai, baru kemudian dihapus.
function useExitAnimation() {
  const [afterExit, setAfterExit] = useState(null)
  const leave = (action) => setAfterExit(() => action)
  const onAnimationEnd = (e) => {
    if (e.target === e.currentTarget && afterExit) afterExit()
  }
  // Cadangan jika event animationend tidak terpicu (misalnya tab sedang di latar belakang).
  useEffect(() => {
    if (!afterExit) return
    const timer = setTimeout(afterExit, 400)
    return () => clearTimeout(timer)
  }, [afterExit])
  return { leaving: Boolean(afterExit), leave, onAnimationEnd }
}

function ChatWindow({ item, conversation }) {
  const { dock } = useChat()
  const navigate = useNavigate()
  const { leaving, leave, onAnimationEnd } = useExitAnimation()
  const name = conversation ? counterpartName(conversation.counterpart) : 'percakapan'
  const minimize = () => leave(() => dock.minimize(item.id))

  return (
    // Jendela naik dari bawah layar saat dibuka dan turun saat ditutup/dikecilkan (lihat index.css).
    <section
      aria-label={`Chat dengan ${name}`}
      onAnimationEnd={onAnimationEnd}
      className={`pointer-events-auto h-[455px] max-h-[calc(100dvh-5rem)] overflow-hidden rounded-t-xl bg-white shadow-2xl ring-1 ring-slate-200 ${
        leaving ? 'pointer-events-none animate-dock-out' : 'animate-dock-in'
      }`}
      style={{ width: WINDOW_WIDTH }}
    >
      <div className="flex h-full flex-col">
        <ChatThread
          conversationId={item.id}
          compact
          autoFocus={item.focus}
          onHeaderClick={minimize}
          headerActions={
            <div className="flex shrink-0 items-center">
              <HeaderButton
                label="Buka di halaman Chat"
                onClick={() => {
                  dock.close(item.id)
                  navigate(`/chat/${item.id}`)
                }}
              >
                <Maximize2 className="size-4" strokeWidth={2.4} />
              </HeaderButton>
              <HeaderButton label="Kecilkan" onClick={minimize}>
                <Minus className="size-5" strokeWidth={2.4} />
              </HeaderButton>
              <HeaderButton label="Tutup" onClick={() => leave(() => dock.close(item.id))}>
                <X className="size-5" strokeWidth={2.4} />
              </HeaderButton>
            </div>
          }
        />
      </div>
    </section>
  )
}

function Bubble({ item, conversation }) {
  const { dock } = useChat()
  const { leaving, leave, onAnimationEnd } = useExitAnimation()
  const person = conversation?.counterpart
  const name = person ? counterpartName(person) : 'Chat'
  const unread = conversation?.unreadCount ?? 0

  return (
    <div onAnimationEnd={onAnimationEnd} className={`group relative ${leaving ? 'animate-pop-out' : 'animate-pop-in'}`}>
      <button
        onClick={() => dock.open(item.id)}
        title={name}
        aria-label={`Buka chat dengan ${name}${unread ? `, ${unread} pesan belum dibaca` : ''}`}
        className="block rounded-full shadow-lg ring-2 ring-white transition-transform hover:scale-105"
      >
        <Avatar name={person?.displayName ?? '?'} src={person?.avatarUrl} size="bubble" />
        {person?.online && <span className="absolute right-0.5 bottom-0.5 size-3 rounded-full bg-green-500 ring-2 ring-white" />}
      </button>
      {unread > 0 && (
        <span className="pointer-events-none absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
          {unread}
        </span>
      )}
      <button
        onClick={() => leave(() => dock.close(item.id))}
        aria-label={`Tutup chat dengan ${name}`}
        className="absolute -top-1 -right-1 hidden size-5 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-200 group-hover:flex focus:flex"
      >
        <X className="size-3.5" strokeWidth={2.6} />
      </button>
    </div>
  )
}
