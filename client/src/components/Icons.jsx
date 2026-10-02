// Ikon aplikasi memakai Lucide (ikon garis, warna mengikuti currentColor) agar seragam dan ikut tema.
// Emoji hanya dipakai untuk reaksi (👍❤️…), bukan untuk ikon navigasi.
export {
  House as HomeIcon,
  MessageCircle as ChatIcon,
  User as UserIcon,
  Sprout as SproutIcon,
  GraduationCap as ClassIcon,
  Shield as ShieldIcon,
  LogOut as LogoutIcon,
} from 'lucide-react'

const BADGE_SIZES = {
  sm: { box: 'size-8', icon: 'size-4' },
  md: { box: 'size-9', icon: 'size-[18px]' },
  lg: { box: 'size-12', icon: 'size-6' },
  xl: { box: 'size-16', icon: 'size-8' },
}

const BADGE_TONES = {
  solid: 'bg-brand-600 text-white', // warna tema + putih (misalnya biru-putih)
  soft: 'bg-brand-50 text-brand-600', // warna tema muda + warna tema
}

// Ikon di dalam lingkaran, dua warna mengikuti tema sekolah.
export function IconBadge({ icon: Icon, size = 'md', tone = 'solid', className = '' }) {
  const s = BADGE_SIZES[size]
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full ${s.box} ${BADGE_TONES[tone]} ${className}`}>
      <Icon className={s.icon} strokeWidth={2.2} />
    </span>
  )
}
