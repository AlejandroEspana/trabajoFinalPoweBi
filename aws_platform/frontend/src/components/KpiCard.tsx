import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: string | number
  subtitle?: string
  accent?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky' | 'slate'
  icon: ReactNode
}

const ACCENT_MAP = {
  indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
}

export function KpiCard({ label, value, subtitle, accent = 'indigo', icon }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${ACCENT_MAP[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
