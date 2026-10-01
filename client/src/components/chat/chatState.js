// Context, hook, dan helper cache yang dipakai bersama oleh komponen-komponen chat.
import { createContext, useContext } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api.js'
import { useMe } from '../../lib/auth.js'
import { canUseChat } from '../../lib/chatSession.js'

export const ChatContext = createContext({ typing: {} })
export const useChat = () => useContext(ChatContext)

// Kunci privat yang sudah terbuka di perangkat ini (diisi oleh ChatGate).
export const LocalKeyContext = createContext(null)
export const useLocalKey = () => useContext(LocalKeyContext)

export const messagesKey = (conversationId) => ['messages', Number(conversationId)]

export const counterpartName = (person) => (person.role === 'parent' ? `Ortu ${person.displayName}` : person.displayName)

export function useConversations() {
  return useQuery({ queryKey: ['conversations'], queryFn: () => api.get('/conversations').then((r) => r.data) })
}

// Daftar orang yang bisa diajak chat (wali kelas / orang tua siswa), beserta status online.
export function useChatContacts(options = {}) {
  return useQuery({ queryKey: ['chat-contacts'], queryFn: () => api.get('/chat/contacts').then((r) => r.data), ...options })
}

// Buka percakapan dengan seorang kontak (dibuat dulu jika belum ada), lalu pindah ke halaman chat.
export function useOpenChat() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (contact) => contact.conversationId ?? (await api.post('/conversations', { userId: contact.id })).data.id,
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['chat-contacts'] })
      navigate(`/chat/${conversationId}`)
    },
  })
}

// Jumlah pesan belum dibaca untuk badge di menu.
export function useUnreadCount() {
  const { data: me } = useMe()
  return useQuery({
    queryKey: ['chat-unread'],
    queryFn: () => api.get('/chat/unread').then((r) => r.data.count),
    enabled: canUseChat(me),
    refetchInterval: 60_000,
  })
}

// Tambahkan pesan ke cache percakapan (pesan bisa datang dua kali: dari respons API dan dari socket).
export function addMessageToCache(queryClient, message) {
  queryClient.setQueryData(messagesKey(message.conversationId), (data) => {
    if (!data || data.pages.some((p) => p.items.some((m) => m.id === message.id))) return data
    const [first, ...rest] = data.pages
    return { ...data, pages: [{ ...first, items: [message, ...first.items] }, ...rest] }
  })
}

export function markReadInCache(queryClient, { conversationId, readerId, readAt }) {
  queryClient.setQueryData(messagesKey(conversationId), (data) =>
    data && {
      ...data,
      pages: data.pages.map((p) => ({
        ...p,
        items: p.items.map((m) => (m.senderId !== readerId && !m.readAt ? { ...m, readAt } : m)),
      })),
    },
  )
}
