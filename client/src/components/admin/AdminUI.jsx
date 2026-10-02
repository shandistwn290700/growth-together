// Komponen tampilan khusus panel admin (gaya dashboard ala Gentelella).
// Grafik dibuat dengan HTML/CSS biasa (tanpa library) agar ringan dan otomatis ikut warna tema.
import { useId, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { IconBadge } from '../Icons.jsx'
import { Badge } from '../ui.jsx'
import { formatNumber } from '../../lib/format.js'
import { useOverlay } from '../../lib/overlay.js'

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold text-slate-800">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ title, description, actions, children, className = '', bodyClassName = 'p-4 sm:p-5' }) {
  return (
    <section className={`rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-800">{title}</h2>
            {description && <p className="text-xs text-slate-500">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

// Kartu angka: label · nilai besar · keterangan.
export function StatTile({ icon, label, value, hint }) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
      <IconBadge icon={icon} size="lg" />
      <div className="min-w-0">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-extrabold text-slate-800">{value}</div>
        {hint && <div className="truncate text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  )
}

// Meter: isian warna tema di atas jalur warna tema yang lebih muda.
export function Meter({ value, max, label }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-brand-100"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

// Angka sumbu yang "bulat": 1, 2, 5, 10, 20, 50, …
function niceMax(value) {
  if (value <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find((s) => s * power >= value)
  return step * power
}

/**
 * Grafik kolom satu seri. data: [{ key, label, value, detail }]
 * - batang maks 24px, ujung atas membulat 4px, tumbuh dari satu garis dasar
 * - garis bantu tipis; label sumbu tidak memakai warna data
 * - arahkan kursor / fokus keyboard pada kolom untuk melihat angkanya
 * - tabel tersembunyi untuk pembaca layar
 */
export function ColumnChart({ data, caption, labelEvery = 1, height = 180 }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)))
  const ticks = [max, max / 2, 0]
  const [active, setActive] = useState(null)

  return (
    <figure>
      <div className="flex gap-2" style={{ height }}>
        {/* Sumbu Y */}
        <div className="flex flex-col justify-between text-right text-[11px] text-slate-400 tabular-nums" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {formatNumber(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* Garis bantu */}
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-slate-100" style={{ bottom: `${(t / max) * 100}%` }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex items-end">
            {data.map((d, i) => (
              <div
                key={d.key}
                tabIndex={0}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative flex h-full flex-1 items-end justify-center outline-none"
                aria-label={`${d.detail ?? d.label}: ${formatNumber(d.value)}`}
              >
                <div
                  className={`w-full max-w-6 rounded-t-[4px] transition-colors ${active === i ? 'bg-brand-700' : 'bg-brand-600'}`}
                  style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                />
                {active === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-center text-xs whitespace-nowrap text-white shadow-lg">
                    <div className="font-bold">{formatNumber(d.value)}</div>
                    <div className="text-slate-300">{d.detail ?? d.label}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Label sumbu X (selektif agar tidak berdesakan) */}
      <div className="mt-1.5 flex pl-8 text-[11px] text-slate-400" aria-hidden>
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center whitespace-nowrap">
            {(data.length - 1 - i) % labelEvery === 0 ? d.label : ''}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.detail ?? d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** Batang horizontal satu seri dengan nilai di ujung batang. data: [{ key, label, value, href }] */
export function BarList({ data, caption, renderLink }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <figure>
      <ul className="space-y-2.5">
        {data.map((d) => {
          const row = (
            <>
              <span className="w-32 shrink-0 truncate text-sm text-slate-700 sm:w-44" title={d.label}>
                {d.label}
              </span>
              <span className="flex flex-1 items-center gap-2">
                <span
                  className="h-5 rounded-r-[4px] bg-brand-600 transition-[width] duration-500"
                  style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? 3 : 0 }}
                />
                <span className="text-sm font-semibold text-slate-600 tabular-nums">{formatNumber(d.value)}</span>
              </span>
            </>
          )
          return (
            <li key={d.key}>
              {renderLink ? renderLink(d, row) : <div className="flex items-center gap-3">{row}</div>}
            </li>
          )
        })}
      </ul>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  )
}

export function Pagination({ page, limit, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(total, page * limit)
  const button =
    'flex size-9 items-center justify-center rounded-lg text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40'
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-500 sm:px-5">
      <span>
        {formatNumber(from)}–{formatNumber(to)} dari {formatNumber(total)}
      </span>
      <div className="flex items-center gap-2">
        <button className={button} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Halaman sebelumnya">
          <ChevronLeft className="size-4" />
        </button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <button className={button} onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Halaman berikutnya">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

// Status akun: belum pernah login / aktif / nonaktif.
export function AccountStatus({ account }) {
  if (!account) return <span className="text-slate-400">—</span>
  if (!account.isActive) return <Badge>Nonaktif</Badge>
  if (account.mustChangePassword) return <Badge variant="amber">Belum login</Badge>
  return <Badge variant="green">Aktif</Badge>
}

export function Modal({ title, onClose, children }) {
  const titleId = useId()
  useOverlay(onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button className="absolute inset-0 animate-fade-in bg-black/50" onClick={onClose} aria-label="Tutup" />
      <div className="relative flex max-h-[90dvh] w-full max-w-xl animate-auth-in flex-col overflow-hidden rounded-t-2xl bg-slate-100 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <h2 id={titleId} className="font-bold">
            {title}
          </h2>
          <button onClick={onClose} className="flex size-9 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Tutup">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 sm:p-4">{children}</div>
      </div>
    </div>
  )
}
