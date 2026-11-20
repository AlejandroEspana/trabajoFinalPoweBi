import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartCard } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import type { DashboardBundle } from '../types/analytics'

interface AcademicPageProps {
  data: DashboardBundle
}

export function AcademicPage({ data }: AcademicPageProps) {
  const [nivelFilter, setNivelFilter] = useState<string>('Todos')

  // Pivot Req 1: asignatura -> { asignatura, Semestre 1, Semestre 2 }
  const req01Pivoted = useMemo(() => {
    const map = new Map<string, { asignatura: string; s1: number | null; s2: number | null; total: number }>()
    for (const row of data.req01_materia_semestre) {
      const entry = map.get(row.asignatura) || { asignatura: row.asignatura, s1: null, s2: null, total: 0 }
      if (row.semestre === 'Semestre 1') entry.s1 = row.promedio_puntaje
      if (row.semestre === 'Semestre 2') entry.s2 = row.promedio_puntaje
      entry.total += row.estudiantes
      map.set(row.asignatura, entry)
    }
    return Array.from(map.values())
  }, [data.req01_materia_semestre])

  // Pivot Req 5 by level: semestre -> { semestre, Primaria, Secundaria, Bachillerato }
  const req05NivelPivoted = useMemo(() => {
    const map = new Map<string, Record<string, string | number>>()
    for (const row of data.req05_semestre_nivel) {
      const entry = map.get(row.semestre) || { semestre: row.semestre }
      entry[row.nivel_educativo] = row.promedio_puntaje
      map.set(row.semestre, entry)
    }
    return Array.from(map.values())
  }, [data.req05_semestre_nivel])

  const niveles = useMemo(
    () => ['Todos', ...Array.from(new Set(data.req04_programas.map((r) => r.nivel_educativo)))],
    [data.req04_programas]
  )

  const filteredProgramas = useMemo(
    () =>
      nivelFilter === 'Todos'
        ? data.req04_programas
        : data.req04_programas.filter((r) => r.nivel_educativo === nivelFilter),
    [data.req04_programas, nivelFilter]
  )

  return (
    <div className="space-y-6">
      {/* Req 1 */}
      <ChartCard
        badge="Req. 1"
        title="Promedio de notas por materia y semestre"
        subtitle="Comparación de puntaje medio (escala 1 a 5) entre Semestre 1 y Semestre 2 en las 12 asignaturas"
        tableContent={
          <DataTable
            rows={data.req01_materia_semestre}
            searchable
            exportFilename="req01_promedio_materia_semestre.csv"
            columns={[
              { key: 'asignatura', label: 'Asignatura' },
              { key: 'semestre', label: 'Semestre' },
              { key: 'estudiantes', label: 'Estudiantes', align: 'right' },
              { key: 'promedio_puntaje', label: 'Promedio Puntaje', align: 'right' },
            ]}
          />
        }
      >
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={req01Pivoted} margin={{ top: 10, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="asignatura" angle={-25} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="s1" name="Semestre 1" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="s2" name="Semestre 2" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Req 4 & Req 5 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          badge="Req. 4"
          title="Comparativa de rendimiento entre programas (nivel educativo y grado)"
          subtitle="Distribución de rendimiento porcentual y promedio por grado"
          headerRight={
            <select
              value={nivelFilter}
              onChange={(e) => setNivelFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              {niveles.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          }
          tableContent={
            <DataTable
              rows={filteredProgramas}
              exportFilename="req04_programas.csv"
              columns={[
                { key: 'nivel_educativo', label: 'Nivel educativo' },
                { key: 'grado', label: 'Grado' },
                { key: 'estudiantes', label: 'Estudiantes', align: 'right' },
                { key: 'promedio_puntaje', label: 'Promedio', align: 'right' },
                { key: 'pct_bajo', label: '% Bajo', align: 'right' },
                { key: 'pct_medio', label: '% Medio', align: 'right' },
                { key: 'pct_alto', label: '% Alto', align: 'right' },
              ]}
            />
          }
        >
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredProgramas} margin={{ top: 10, right: 16, left: 0, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="grado" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(val: number) => `${val}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pct_bajo" stackId="p" name="% Bajo" fill="#f43f5e" />
                <Bar dataKey="pct_medio" stackId="p" name="% Medio" fill="#f59e0b" />
                <Bar dataKey="pct_alto" stackId="p" name="% Alto" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          badge="Req. 5"
          title="Tendencias en rendimiento por semestre y nivel educativo"
          subtitle="Evolución del puntaje promedio ordinal entre Semestre 1 y Semestre 2"
          tableContent={
            <DataTable
              rows={data.req05_semestre}
              exportFilename="req05_semestre.csv"
              columns={[
                { key: 'semestre', label: 'Semestre' },
                { key: 'estudiantes', label: 'Estudiantes', align: 'right' },
                { key: 'promedio_puntaje', label: 'Promedio', align: 'right' },
                { key: 'pct_bajo', label: '% Bajo', align: 'right' },
                { key: 'pct_medio', label: '% Medio', align: 'right' },
                { key: 'pct_alto', label: '% Alto', align: 'right' },
              ]}
            />
          }
        >
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={req05NivelPivoted} margin={{ top: 16, right: 24, left: 0, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="semestre" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis domain={[2, 4]} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Primaria" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 5 }} />
                <Line type="monotone" dataKey="Secundaria" stroke="#10b981" strokeWidth={2.5} dot={{ r: 5 }} />
                <Line type="monotone" dataKey="Bachillerato" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Req 6 & Req 9 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          badge="Req. 6"
          title="Top 10 asignaturas con mayor reprobación"
          subtitle="Ranking por porcentaje de estudiantes reprobados (clase Bajo)"
          tableContent={
            <DataTable
              rows={data.req06_top10_reprobacion}
              exportFilename="req06_top10_reprobacion.csv"
              columns={[
                { key: 'posicion', label: '#', align: 'center' },
                { key: 'asignatura', label: 'Asignatura' },
                { key: 'estudiantes', label: 'Estudiantes', align: 'right' },
                { key: 'reprobados', label: 'Reprobados', align: 'right' },
                { key: 'pct_reprobacion', label: '% Reprobación', align: 'right' },
              ]}
            />
          }
        >
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.req06_top10_reprobacion}
                layout="vertical"
                margin={{ top: 5, right: 24, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis type="category" dataKey="asignatura" width={85} tick={{ fontSize: 11, fill: '#334155' }} />
                <Tooltip formatter={(val: number) => [`${val}%`, '% Reprobación']} />
                <Bar dataKey="pct_reprobacion" name="% Reprobación" fill="#f43f5e" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          badge="Req. 9"
          title="Comparativa de resultados entre cohortes (grado escolar)"
          subtitle="Puntaje promedio ordinal y composición por cohorte (G-02 a G-12)"
          tableContent={
            <DataTable
              rows={data.req09_cohortes}
              exportFilename="req09_cohortes.csv"
              columns={[
                { key: 'cohorte_grado', label: 'Cohorte (Grado)' },
                { key: 'estudiantes', label: 'Estudiantes', align: 'right' },
                { key: 'promedio_puntaje', label: 'Promedio', align: 'right' },
                { key: 'pct_bajo', label: '% Bajo', align: 'right' },
                { key: 'pct_medio', label: '% Medio', align: 'right' },
                { key: 'pct_alto', label: '% Alto', align: 'right' },
              ]}
            />
          }
        >
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.req09_cohortes} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="cohorte_grado" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip />
                <Bar dataKey="promedio_puntaje" name="Promedio puntaje (1–5)" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
