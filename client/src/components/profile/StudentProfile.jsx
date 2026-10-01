import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { Alert, Spinner } from '../ui.jsx'
import PostComposer from '../feed/PostComposer.jsx'
import StudentHeader, { ClassJourney } from './StudentHeader.jsx'
import { StudentGallery, StudentTimeline } from './StudentTimeline.jsx'

const TABS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'gallery', label: 'Galeri' },
]

export default function StudentProfile({ studentId, isOwnChild = false }) {
  const [tab, setTab] = useState('timeline')
  const [classroomId, setClassroomId] = useState(null)

  const profile = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => api.get(`/students/${studentId}`).then((r) => r.data),
  })

  if (profile.isPending) return <Spinner />
  if (profile.isError) return <Alert>{getErrorMessage(profile.error)}</Alert>

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <StudentHeader profile={profile.data} isOwnChild={isOwnChild} />

      {profile.data.history.length > 0 && (
        <ClassJourney history={profile.data.history} selected={classroomId} onSelect={setClassroomId} />
      )}

      <div role="tablist" className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
              tab === t.id ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-xl space-y-4">
        {tab === 'timeline' ? (
          <>
            {isOwnChild && profile.data.canPost && <PostComposer />}
            <StudentTimeline studentId={studentId} classroomId={classroomId} history={profile.data.history} />
          </>
        ) : (
          <StudentGallery studentId={studentId} classroomId={classroomId} />
        )}
      </div>
    </div>
  )
}
