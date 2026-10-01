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

export function initial(name) {
  return name?.trim()?.[0]?.toUpperCase() ?? '?'
}
