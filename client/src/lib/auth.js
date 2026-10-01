import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import api, { TOKEN_KEY } from './api.js'
import { clearLocalKey } from './chatSession.js'
import { disconnectSocket } from './socket.js'

export const ROLE_LABELS = { admin: 'Admin', teacher: 'Guru', parent: 'Orang Tua' }

export function hasToken() {
  return Boolean(localStorage.getItem(TOKEN_KEY))
}

// Data user yang sedang login. Disimpan di cache TanStack Query dengan key ['me'].
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((res) => res.data),
    enabled: hasToken(),
    staleTime: Infinity,
  })
}

export function useAuthActions() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return {
    saveSession({ access_token, user }) {
      localStorage.setItem(TOKEN_KEY, access_token)
      queryClient.setQueryData(['me'], user)
    },
    logout() {
      localStorage.removeItem(TOKEN_KEY)
      clearLocalKey()
      disconnectSocket()
      try {
        sessionStorage.removeItem('gt-chat-dock') // jendela chat mini milik akun ini
      } catch {
        // abaikan
      }
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  }
}
