import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useMe } from '../../lib/auth.js'
import { canUseChat } from '../../lib/chatSession.js'
import { connectSocket } from '../../lib/socket.js'
import { ChatContext, addMessageToCache, markReadInCache } from './chatState.js'

const TYPING_TIMEOUT = 4000

// Menghubungkan Socket.IO dengan cache data: pesan baru, sudah dibaca, status online, mengetik.
export function ChatProvider({ children }) {
  const { data: me } = useMe()
  const queryClient = useQueryClient()
  const [typing, setTyping] = useState({}) // conversationId -> waktu terakhir mengetik
  const enabled = canUseChat(me)

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

  return <ChatContext.Provider value={{ typing }}>{children}</ChatContext.Provider>
}
