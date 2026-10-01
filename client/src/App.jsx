import { Routes, Route, Navigate } from 'react-router'
import MainLayout from './layouts/MainLayout.jsx'
import { RequireAuth, RequireRole } from './components/RouteGuards.jsx'
import HomePage from './pages/HomePage.jsx'
import ProfilePage, { StudentProfilePage } from './pages/ProfilePage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ChangePasswordPage from './pages/ChangePasswordPage.jsx'
import ClassroomsPage from './pages/ClassroomsPage.jsx'
import ClassroomDetailPage from './pages/ClassroomDetailPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

export default function App() {
  return (
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
  )
}
