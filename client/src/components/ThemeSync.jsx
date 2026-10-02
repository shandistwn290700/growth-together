import { useEffect } from 'react'
import { applyTheme } from '../lib/theme.js'
import { useAppearance } from '../lib/useAppearance.js'

// Ambil tema sekolah dari server dan pasang ke seluruh aplikasi.
// Diperbarui otomatis saat pengguna kembali ke tab aplikasi, jadi perubahan dari admin cepat terlihat.
export default function ThemeSync() {
  const { data } = useAppearance()

  useEffect(() => {
    if (data?.theme) applyTheme(data.theme)
  }, [data?.theme])

  return null
}
