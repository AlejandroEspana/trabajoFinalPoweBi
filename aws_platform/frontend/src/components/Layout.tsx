import type { ReactNode } from 'react'
import {
  Activity,
  BarChart3,
  BookOpen,
  Database,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  RefreshCw,
  ShieldAlert,
  TableProperties,
} from 'lucide-react'
import type { EtlControlRow } from '../types/analytics'

export type NavSection = 'overview' | 'academic' | 'risk' | 'anova' | 'tables'

interface LayoutProps {
  active: NavSection
  onSelect: (section: NavSection) => void
  etlLast: EtlControlRow | null
  totalStudents: number
  onRefresh: () => void
  refreshing: boolean
  children: ReactNode
}

const NAV_ITEMS: { id: NavSection; label: string; desc: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Resumen Ejecutivo', desc: 'KPIs & vista general', icon: LayoutDashboard },
  { id: 'academic', label: 'Desempeño Académico', desc: 'Req. 1, 4, 5, 6 y 9', icon: BarChart3 },
  { id: 'risk', label: 'Riesgo y Factores', desc: 'Req. 2, 3, 7 y 10', icon: ShieldAlert },
  { id: 'anova', label: 'Laboratorio ANOVA', desc: 'Componente estadístico', icon: FlaskConical },
  { id: 'tables', label: 'Tablas & Sobresalientes', desc: 'Req. 8 y vistas SQL', icon: TableProperties },
]

export function Layout({
  active,
  onSelect,
  etlLast,
  totalStudents,
  onRefresh,
  refreshing,
  children,
}: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-900">EduAnalytics BI</p>
            <p className="text-[11px] text-slate-500">Proyecto 2 · xAPI-Edu-Data</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Módulos Analíticos
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/15'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{item.label}</p>
                  <p className="truncate text-[11px] text-slate-400">{item.desc}</p>
                </div>
              </button>
            )
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600 ring-1 ring-slate-200/70">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Database className="h-3.5 w-3.5 text-emerald-600" />
              PostgreSQL conectado
            </div>
            <p className="mt-1 text-slate-500">
              Esquema <code className="font-mono text-slate-700">academico</code> ·{' '}
              <span className="font-semibold tabular-nums text-slate-700">{totalStudents}</span> registros
            </p>
            {etlLast && (
              <p className="mt-1 text-[10px] text-slate-400">
                ETL #{etlLast.id_ejecucion} ({etlLast.estado}) · {etlLast.archivo_origen}
              </p>
            )}
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-700"
            >
              <BookOpen className="h-3 w-3" />
              Documentación API (Swagger)
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 lg:px-8">
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                Evaluación del Rendimiento Académico Universitario
              </h1>
              <p className="text-xs text-slate-500">
                Pipeline ETL PySpark → PostgreSQL (14 vistas) → FastAPI + ANOVA → React Dashboard
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <Activity className="h-3.5 w-3.5" />
                Live · AWS / PostgreSQL
              </span>
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>

          {/* Mobile Nav */}
          <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
