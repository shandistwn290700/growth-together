import { SproutIcon } from './Icons.jsx'

// Layar penuh sesaat saat login (sambutan) dan logout (perpisahan).
export default function AuthSplash({ title, subtitle }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] flex animate-fade-in flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-500 px-6 text-center text-white"
    >
      <span className="flex size-24 origin-bottom animate-sprout-grow items-center justify-center rounded-full bg-white/15 ring-4 ring-white/20">
        <SproutIcon className="size-14" />
      </span>
      <p className="animate-rise text-2xl font-extrabold sm:text-3xl" style={{ animationDelay: '250ms' }}>
        {title}
      </p>
      {subtitle && (
        <p className="animate-rise text-brand-100" style={{ animationDelay: '400ms' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
