import { Navigate, Outlet } from 'react-router'
import { hasToken, useMe } from '../lib/auth.js'
import { Spinner } from './ui.jsx'

// Hanya untuk user yang sudah login. Jika masih memakai password awal, arahkan ke halaman ganti password.
export function RequireAuth({ allowPasswordChange = false }) {
  const me = useMe()

  if (!hasToken()) return <Navigate to="/login" replace />
  if (me.isPending) return <Spinner />
  if (me.isError) return <Navigate to="/login" replace />
  if (me.data.mustChangePassword && !allowPasswordChange) return <Navigate to="/ganti-password" replace />
  return <Outlet />
}

export function RequireRole({ roles }) {
  const { data: me } = useMe()
  return roles.includes(me?.role) ? <Outlet /> : <Navigate to="/" replace />
}
