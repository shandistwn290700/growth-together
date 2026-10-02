import { useParams } from 'react-router'
import ChatGate from '../components/chat/ChatGate.jsx'
import ConversationList from '../components/chat/ConversationList.jsx'
import ChatThread from '../components/chat/ChatThread.jsx'
import { ChatIcon, IconBadge } from '../components/Icons.jsx'

// Laptop: daftar percakapan di kiri, isi chat di kanan. HP: bergantian (seperti Messenger).
export default function ChatPage() {
  const { conversationId } = useParams()

  return (
    <ChatGate>
      {/* minmax(0,1fr): kolom tidak boleh melebar mengikuti teks panjang (pratinjau pesan) */}
      <div
        data-thread={Boolean(conversationId)}
        className={`chat-screen grid grid-cols-[minmax(0,1fr)] overflow-hidden bg-white shadow-sm md:grid-cols-[20rem_minmax(0,1fr)] md:rounded-xl ${
          conversationId ? '' : 'rounded-xl'
        }`}
      >
        <aside className={`min-h-0 min-w-0 border-slate-100 md:flex md:border-r ${conversationId ? 'hidden' : 'flex'}`}>
          <ConversationList activeId={conversationId} />
        </aside>
        <section className={`min-h-0 min-w-0 md:flex ${conversationId ? 'flex' : 'hidden'}`}>
          {conversationId ? (
            <ChatThread key={conversationId} conversationId={conversationId} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-slate-500">
              <IconBadge icon={ChatIcon} size="xl" tone="soft" />
              <p className="mt-1 font-semibold">Pilih percakapan</p>
              <p className="max-w-xs text-sm">Semua pesan terenkripsi end-to-end antara guru dan orang tua.</p>
            </div>
          )}
        </section>
      </div>
    </ChatGate>
  )
}
