import { useQuery } from '@tanstack/react-query'
import api from './api.js'

export const APPEARANCE_KEY = ['appearance']

// Pengaturan tampilan sekolah (tema warna). Bisa dibaca tanpa login karena halaman login juga memakainya.
export function useAppearance() {
  return useQuery({
    queryKey: APPEARANCE_KEY,
    queryFn: () => api.get('/settings/appearance').then((r) => r.data),
    staleTime: 5 * 60_000,
  })
}
