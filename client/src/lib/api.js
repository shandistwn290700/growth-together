import axios from 'axios'

export const TOKEN_KEY = 'gt_access_token'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Sesi habis/tidak valid: hapus token dan kembali ke halaman login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url === '/auth/login'
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem(TOKEN_KEY)
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export function getErrorMessage(error) {
  return error?.response?.data?.message ?? 'Terjadi kesalahan, silakan coba lagi'
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default api
