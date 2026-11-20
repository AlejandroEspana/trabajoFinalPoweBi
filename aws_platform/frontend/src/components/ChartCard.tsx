import { useState, type ReactNode } from 'react'
import { BarChart3, Table2 } from 'lucide-react'

interface ChartCardProps {
  badge?: string
  title: string
  subtitle?: string
  children: ReactNode
  tableContent?: ReactNode
  headerRight?: ReactNode
}

export function ChartCard({ badge, title, subtitle, children, tableContent, headerRight }: ChartCardProps) {
  const [mode, setMode] = useState<'chart' | 'table'>('chart')

  return (
    <section className="flex flex-col rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {badge && (
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/15">
                {badge}
              </span>
            )}
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          </div>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {headerRight}
          {tableContent && (
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode('chart')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
                  mode === 'chart' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Gráfico
              </button>
              <button
                type="button"
                onClick={() => setMode('table')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
                  mode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" />
                Tabla
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-5">{mode === 'chart' || !tableContent ? children : tableContent}</div>
    </section>
  )
}
