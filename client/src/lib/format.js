const relative = new Intl.RelativeTimeFormat('id', { numeric: 'auto' })

// "baru saja", "5 menit yang lalu", "kemarin", lalu tanggal lengkap setelah seminggu.
export function timeAgo(value) {
  const date = new Date(value)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return 'baru saja'
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86400) return relative.format(Math.round(seconds / 86400), 'day')
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function fullDate(value) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })
}

const number = new Intl.NumberFormat('id-ID')
export const formatNumber = (n) => number.format(n ?? 0)

// Waktu login terakhir: "Hari ini", "3 hari yang lalu", lalu tanggal setelah sebulan.
export function lastSeen(value) {
  if (!value) return 'Belum pernah'
  const days = Math.round((new Date(value).getTime() - Date.now()) / 86400_000)
  if (days === 0) return 'Hari ini'
  if (days > -30) return relative.format(days, 'day')
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Nama panggilan hanya ditampilkan jika ada dan berbeda dari nama lengkap.
export function showNickname(student) {
  const nickname = student?.nickname?.trim()
  return nickname && nickname.toLowerCase() !== student.fullName.trim().toLowerCase() ? nickname : null
}

export function initial(name) {
  return name?.trim()?.[0]?.toUpperCase() ?? '?'
}

// Nama penulis postingan: akun orang tua ditampilkan sebagai "Orang tua <nama anak>"
export const authorName = (author) => (author.role === 'parent' ? `Orang tua ${author.displayName}` : author.displayName)
