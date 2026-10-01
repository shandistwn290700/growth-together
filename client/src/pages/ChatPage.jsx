import { useParams } from 'react-router'
import ChatGate from '../components/chat/ChatGate.jsx'
import ConversationList from '../components/chat/ConversationList.jsx'
import ChatThread from '../components/chat/ChatThread.jsx'

// Laptop: daftar percakapan di kiri, isi chat di kanan. HP: bergantian (seperti Messenger).
export default function ChatPage() {
  const { conversationId } = useParams()

  return (
    <ChatGate>
      <div className="grid h-[calc(100dvh-10.5rem)] overflow-hidden rounded-xl bg-white shadow-sm md:h-[calc(100dvh-6.5rem)] md:grid-cols-[20rem_1fr]">
        <aside className={`min-h-0 border-slate-100 md:flex md:border-r ${conversationId ? 'hidden' : 'flex'}`}>
          <ConversationList activeId={conversationId} />
        </aside>
        <section className={`min-h-0 md:flex ${conversationId ? 'flex' : 'hidden'}`}>
          {conversationId ? (
            <ChatThread key={conversationId} conversationId={conversationId} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-slate-500">
              <span className="text-5xl">💬</span>
              <p className="font-semibold">Pilih percakapan</p>
              <p className="max-w-xs text-sm">Semua pesan terenkripsi end-to-end antara guru dan orang tua.</p>
            </div>
          )}
        </section>
      </div>
    </ChatGate>
  )
}
