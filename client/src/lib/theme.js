// Tema warna sekolah. Setiap tema adalah satu palet (50 = paling muda … 900 = paling tua).
// Semua pilihan sudah dicek: tulisan putih di atas brand-600/700 tetap mudah dibaca.
// Daftar kunci tema yang sama ada di server (controllers/settingsController.js).
export const THEMES = {
  toska: {
    label: 'Toska',
    shades: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a' },
  },
  biru: {
    label: 'Biru',
    shades: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
  },
  langit: {
    label: 'Biru Langit',
    shades: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e' },
  },
  nila: {
    label: 'Nila',
    shades: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81' },
  },
  ungu: {
    label: 'Ungu',
    shades: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95' },
  },
  zamrud: {
    label: 'Hijau Zamrud',
    shades: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
  },
  'merah-muda': {
    label: 'Merah Muda',
    shades: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337' },
  },
  jingga: {
    label: 'Jingga',
    shades: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
  },
}

export const DEFAULT_THEME = 'toska'
const STORAGE_KEY = 'gt-theme'

// Warna tema disimpan sebagai variabel CSS (--color-brand-50 … 900) yang dipakai semua class
// brand-* dari Tailwind, jadi seluruh tampilan langsung berganti tanpa memuat ulang halaman.
export function applyTheme(key) {
  const theme = THEMES[key] ?? THEMES[DEFAULT_THEME]
  const root = document.documentElement
  Object.entries(theme.shades).forEach(([shade, hex]) => root.style.setProperty(`--color-brand-${shade}`, hex))
  updateFavicon(theme.shades[700])
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // tidak masalah, tema tetap diambil dari server
  }
}

// Dipakai saat aplikasi pertama dibuka, agar tidak "berkedip" warna lama sebelum data tema dari server tiba.
export function applyCachedTheme() {
  let key = DEFAULT_THEME
  try {
    key = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME
  } catch {
    // pakai default
  }
  applyTheme(key)
}

// Ikon tab browser ikut berwarna tema.
function updateFavicon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${color}"/><path d="M16 26V14" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M16 16c0-5 3-8 8-8 0 5-3 8-8 8Z" fill="#fff" fill-opacity=".75"/><path d="M16 19c0-4-2.5-6.5-6.5-6.5 0 4 2.5 6.5 6.5 6.5Z" fill="#fff"/></svg>`
  let link = document.querySelector('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/svg+xml'
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
}
