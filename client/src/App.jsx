import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router'
import MainLayout from './layouts/MainLayout.jsx'
import { RequireAuth, RequireRole } from './components/RouteGuards.jsx'
import { Spinner } from './components/ui.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'

// Halaman selain Beranda & Login baru diunduh saat dibuka, agar aplikasi cepat tampil di HP.
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const StudentProfilePage = lazy(() => import('./pages/ProfilePage.jsx').then((m) => ({ default: m.StudentProfilePage })))
const ChatPage = lazy(() => import('./pages/ChatPage.jsx'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage.jsx'))
const ClassroomsPage = lazy(() => import('./pages/ClassroomsPage.jsx'))
const ClassroomDetailPage = lazy(() => import('./pages/ClassroomDetailPage.jsx'))
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'))

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth allowPasswordChange />}>
          <Route path="/ganti-password" element={<ChangePasswordPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="profil" element={<ProfilePage />} />
            <Route path="siswa/:id" element={<StudentProfilePage />} />
            <Route element={<RequireRole roles={['teacher', 'parent']} />}>
              <Route path="chat" element={<ChatPage />} />
              <Route path="chat/:conversationId" element={<ChatPage />} />
            </Route>
            <Route element={<RequireRole roles={['admin', 'teacher']} />}>
              <Route path="kelas" element={<ClassroomsPage />} />
              <Route path="kelas/:id" element={<ClassroomDetailPage />} />
            </Route>
            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
