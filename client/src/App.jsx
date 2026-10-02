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

// Panel admin (terpisah dari Beranda)
const AdminLayout = lazy(() => import('./layouts/AdminLayout.jsx'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage.jsx'))
const StudentsPage = lazy(() => import('./pages/admin/StudentsPage.jsx'))
const TeachersPage = lazy(() => import('./pages/admin/TeachersPage.jsx'))
const ModerationPage = lazy(() => import('./pages/admin/ModerationPage.jsx'))
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage.jsx'))
const settings = () => import('./pages/admin/SettingsPages.jsx')
const AcademicYearsPage = lazy(() => settings().then((m) => ({ default: m.AcademicYearsPage })))
const ImportPage = lazy(() => settings().then((m) => ({ default: m.ImportPage })))
const ThemePage = lazy(() => settings().then((m) => ({ default: m.ThemePage })))

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
          </Route>

          <Route element={<RequireRole roles={['admin']} />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="kelas" element={<ClassroomsPage />} />
              <Route path="kelas/:id" element={<ClassroomDetailPage />} />
              <Route path="siswa" element={<StudentsPage />} />
              <Route path="guru" element={<TeachersPage />} />
              <Route path="tahun-ajaran" element={<AcademicYearsPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="moderasi" element={<ModerationPage />} />
              <Route path="laporan" element={<ReportsPage />} />
              <Route path="tema" element={<ThemePage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
