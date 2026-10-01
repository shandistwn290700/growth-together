import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useMe } from '../../lib/auth.js'
import { canUseChat } from '../../lib/chatSession.js'
import { connectSocket } from '../../lib/socket.js'
import { ChatContext, addMessageToCache, isWideScreen, markReadInCache, useChatKeyStatus } from './chatState.js'

const TYPING_TIMEOUT = 4000
const DOCK_STORE = 'gt-chat-dock'

function loadDock() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DOCK_STORE))
    return Array.isArray(saved) ? saved.filter((w) => Number.isInteger(w?.id)).map((w) => ({ ...w, focus: false })) : []
  } catch {
    return []
  }
}

// Jendela chat mini ala Facebook. Urutan array = urutan dibuka (terakhir = terbaru = paling kanan).
function useDock(available) {
  const [windows, setWindows] = useState(loadDock)

  // Diingat selama tab browser terbuka, agar jendela tetap ada setelah pindah halaman/refresh.
  useEffect(() => {
    try {
      sessionStorage.setItem(DOCK_STORE, JSON.stringify(windows.map(({ id, minimized }) => ({ id, minimized }))))
    } catch {
      // abaikan
    }
  }, [windows])

  // Dibuka oleh user: pindah ke posisi paling kanan dan langsung siap mengetik.
  const open = useCallback(
    (id) => setWindows((ws) => [...ws.filter((w) => w.id !== id), { id, minimized: false, focus: true }]),
    [],
  )
  // Pesan masuk: buka jendela jika belum ada (yang sedang dikecilkan tetap dikecilkan).
  const receive = useCallback(
    (id) => setWindows((ws) => (ws.some((w) => w.id === id) ? ws : [...ws, { id, minimized: false, focus: false }])),
    [],
  )
  const minimize = useCallback((id) => setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, minimized: true } : w))), [])
  const close = useCallback((id) => setWindows((ws) => ws.filter((w) => w.id !== id)), [])

  return useMemo(() => ({ available, windows, open, receive, minimize, close }), [available, windows, open, receive, minimize, close])
}

// Menghubungkan Socket.IO dengan cache data: pesan baru, sudah dibaca, status online, mengetik.
export function ChatProvider({ children }) {
  const { data: me } = useMe()
  const queryClient = useQueryClient()
  const { pathname } = useLocation()
  const [typing, setTyping] = useState({}) // conversationId -> waktu terakhir mengetik
  const enabled = canUseChat(me)
  const keyStatus = useChatKeyStatus()
  // Jendela mini tidak dipakai di halaman Chat penuh, dan butuh kunci chat yang sudah terbuka.
  const dock = useDock(Boolean(enabled && keyStatus.data?.ready && !pathname.startsWith('/chat')))

  // Nilai terbaru untuk dipakai di dalam handler socket (yang hanya didaftarkan sekali).
  const latest = useRef({})
  useEffect(() => {
    latest.current = { myId: me?.id, dock }
  })

  useEffect(() => {
    if (!enabled) return
    const socket = connectSocket()

    const refreshLists = () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
    }
    const onMessage = (message) => {
      addMessageToCache(queryClient, message)
      setTyping((t) => ({ ...t, [message.conversationId]: 0 }))
      refreshLists()
      // Seperti Facebook: pesan masuk membuka jendela chat pengirimnya di pojok kanan bawah.
      const { myId, dock: currentDock } = latest.current
      if (message.senderId !== myId && currentDock?.available && isWideScreen()) currentDock.receive(message.conversationId)
    }
    const onRead = (payload) => {
      markReadInCache(queryClient, payload)
      refreshLists()
    }
    const onPresence = ({ userId, online }) => {
      const update = (c) => (c.counterpart.id === userId ? { ...c, counterpart: { ...c.counterpart, online } } : c)
      queryClient.setQueryData(['conversations'], (list) => list?.map(update))
      queryClient.setQueryData(['chat-contacts'], (list) => list?.map((c) => (c.id === userId ? { ...c, online } : c)))
    }
    const onTyping = ({ conversationId, isTyping }) =>
      setTyping((t) => ({ ...t, [conversationId]: isTyping ? Date.now() : 0 }))
    // Setelah koneksi tersambung ulang, ambil data terbaru karena mungkin ada event yang terlewat.
    const onReconnect = () => {
      refreshLists()
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    }

    socket.on('message:new', onMessage)
    socket.on('messages:read', onRead)
    socket.on('presence', onPresence)
    socket.on('typing', onTyping)
    socket.io.on('reconnect', onReconnect)
    return () => {
      socket.off('message:new', onMessage)
      socket.off('messages:read', onRead)
      socket.off('presence', onPresence)
      socket.off('typing', onTyping)
      socket.io.off('reconnect', onReconnect)
    }
  }, [enabled, queryClient])

  // Indikator mengetik hilang sendiri setelah 4 detik tanpa kabar.
  useEffect(() => {
    const timer = setInterval(() => {
      setTyping((t) => {
        const now = Date.now()
        const isStale = (at) => at && now - at > TYPING_TIMEOUT
        if (!Object.values(t).some(isStale)) return t
        return Object.fromEntries(Object.entries(t).map(([id, at]) => [id, isStale(at) ? 0 : at]))
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const value = useMemo(() => ({ typing, dock, localKey: keyStatus.data?.local ?? null }), [typing, dock, keyStatus.data])
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
