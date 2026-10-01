const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function HomeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  )
}

export function ChatIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  )
}

export function UserIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

export function ClassIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 8 12 4l9 4-9 4z" />
      <path d="M7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5" />
    </svg>
  )
}

export function ShieldIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z" />
    </svg>
  )
}

export function LogoutIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
    </svg>
  )
}

export function SproutIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4.5 2.7-7 7-7 0 4.5-2.7 7-7 7Z" />
      <path d="M12 15c0-3.6-2.2-5.5-5.5-5.5 0 3.6 2.2 5.5 5.5 5.5Z" />
    </svg>
  )
}
