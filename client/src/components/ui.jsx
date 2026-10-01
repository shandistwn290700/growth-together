// Komponen UI kecil yang dipakai berulang di banyak halaman.

export function Card({ className = '', children }) {
  return <section className={`rounded-xl bg-white p-5 shadow-sm ${className}`}>{children}</section>
}

const BUTTON_VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/50',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50',
}

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100'

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function Input(props) {
  return <input className={FIELD_CLASS} {...props} />
}

export function Select(props) {
  return <select className={FIELD_CLASS} {...props} />
}

const ALERT_VARIANTS = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-brand-100 bg-brand-50 text-brand-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
}

export function Alert({ variant = 'error', children }) {
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${ALERT_VARIANTS[variant]}`}>
      {children}
    </div>
  )
}

const BADGE_VARIANTS = {
  green: 'bg-brand-50 text-brand-700',
  gray: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-50 text-amber-800',
  blue: 'bg-sky-50 text-sky-700',
}

export function Badge({ variant = 'gray', children }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${BADGE_VARIANTS[variant]}`}>{children}</span>
}

export function Spinner({ label = 'Memuat…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <span className="size-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      {label}
    </div>
  )
}
