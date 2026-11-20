import { useCallback, useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Layout, type NavSection } from './components/Layout'
import { AcademicPage } from './pages/AcademicPage'
import { AnovaPage } from './pages/AnovaPage'
import { FactorsRiskPage } from './pages/FactorsRiskPage'
import { OverviewPage } from './pages/OverviewPage'
import { StudentsTablePage } from './pages/StudentsTablePage'
import { api } from './services/api'
import type { DashboardBundle } from './types/analytics'

export function App() {
  const [section, setSection] = useState<NavSection>('overview')
  const [data, setData] = useState<DashboardBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    api
      .getDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la API'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Suscripción en tiempo real a cambios de PostgreSQL (LISTEN/NOTIFY vía SSE)
  useEffect(() => {
    const source = new EventSource('/api/v1/stream')
    let timer: number | undefined

    source.addEventListener('update', () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        loadData()
        setRevision((r) => r + 1)
      }, 300)
    })

    return () => {
      window.clearTimeout(timer)
      source.close()
    }
  }, [loadData])

  return (
    <Layout
      active={section}
      onSelect={setSection}
      etlLast={data?.etl_ultimo ?? null}
      totalStudents={data?.resumen.estudiantes ?? 0}
      onRefresh={() => {
        loadData()
        setRevision((r) => r + 1)
      }}
      refreshing={loading}
    >
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Error conectando con el backend: {error}
        </div>
      )}

      {!data && loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-sm text-slate-500">
          Cargando datos desde PostgreSQL...
        </div>
      )}

      {data && (
        <>
          {section === 'overview' && <OverviewPage data={data} />}
          {section === 'academic' && <AcademicPage data={data} />}
          {section === 'risk' && <FactorsRiskPage data={data} />}
          {section === 'anova' && <AnovaPage key={revision} />}
          {section === 'tables' && <StudentsTablePage key={revision} data={data} />}
        </>
      )}
    </Layout>
  )
}

export default App
