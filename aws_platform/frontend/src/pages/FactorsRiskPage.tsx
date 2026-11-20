import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartCard } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import type { DashboardBundle } from '../types/analytics'

interface FactorsRiskPageProps {
  data: DashboardBundle
}

export function FactorsRiskPage({ data }: FactorsRiskPageProps) {
  const factoresDisponibles = useMemo(
    () => Array.from(new Set(data.req10_factores.map((r) => r.factor))),
    [data.req10_factores]
  )
  const [selectedFactor, setSelectedFactor] = useState<string>(factoresDisponibles[0] || 'Ausencias')

  const factorRows = useMemo(
    () => data.req10_factores.filter((r) => r.factor === selectedFactor),
    [data.req10_factores, selectedFactor]
  )

  return (
    <div className="space-y-6">
      {/* Req 2 & Req 3 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          badge="Req. 2"
          title="Tasa de deserción por facultad (proxy: riesgo de deserción)"
          subtitle="Estudiantes con clase Bajo y más de 7 ausencias por facultad"
          tableContent={
            <DataTable
              rows={data.req02_desercion_facultad}
              exportFilename="req02_desercion_facultad.csv"
              columns={[
                { key: 'facultad', label: 'Facultad' },
                { key: 'estudiantes', label: 'Estudiantes', align: 'right' },
                { key: 'en_riesgo', label: 'En riesgo', align: 'right' },
                { key: 'tasa_riesgo_pct', label: 'Tasa riesgo (%)', align: 'right' },
              ]}
            />
          }
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.req02_desercion_facultad} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="facultad" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="tasa_riesgo_pct" name="Tasa de riesgo (%)" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          badge="Req. 3"
          title="Análisis de desempeño por género"
          subtitle="Distribución porcentual de clases Bajo, Medio y Alto por género"
          tableContent={
            <DataTable
              rows={data.req03_desempeno_genero}
              exportFilename="req03_desempeno_genero.csv"
              columns={[
                { key: 'genero', label: 'Género' },
                { key: 'estudiantes', label: 'Estudiantes', align: 'right' },
                { key: 'promedio_puntaje', label: 'Promedio', align: 'right' },
                { key: 'pct_bajo', label: '% Bajo', align: 'right' },
                { key: 'pct_medio', label: '% Medio', align: 'right' },
                { key: 'pct_alto', label: '% Alto', align: 'right' },
              ]}
            />
          }
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.req03_desempeno_genero} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="genero" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pct_bajo" stackId="g" name="% Bajo" fill="#f43f5e" maxBarSize={80} />
                <Bar dataKey="pct_medio" stackId="g" name="% Medio" fill="#f59e0b" maxBarSize={80} />
                <Bar dataKey="pct_alto" stackId="g" name="% Alto" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={80} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Req 7 & Req 10b */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          badge="Req. 7"
          title="Relación entre asistencia (ausencias) y rendimiento"
          subtitle="Comparación entre estudiantes con menos de 7 ausencias vs más de 7 ausencias"
          tableContent={
            <DataTable
              rows={data.req07_asistencia_rendimiento}
              exportFilename="req07_asistencia_rendimiento.csv"
              columns={[
                { key: 'ausencias', label: 'Ausencias' },
                { key: 'estudiantes', label: 'Estudiantes', align: 'right' },
                { key: 'promedio_puntaje', label: 'Promedio', align: 'right' },
                { key: 'participacion_media', label: 'Participación', align: 'right' },
                { key: 'pct_bajo', label: '% Bajo', align: 'right' },
                { key: 'pct_alto', label: '% Alto', align: 'right' },
              ]}
            />
          }
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.req07_asistencia_rendimiento} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="ausencias" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pct_bajo" name="% Bajo" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pct_medio" name="% Medio" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pct_alto" name="% Alto" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          badge="Req. 10"
          title="Participación media en plataforma según nivel de rendimiento"
          subtitle="Promedio (0–100) de interacciones en clase por nivel Bajo, Medio y Alto"
          tableContent={
            <DataTable
              rows={data.req10_participacion_clase}
              exportFilename="req10_participacion_clase.csv"
              columns={[
                { key: 'clase', label: 'Nivel' },
                { key: 'estudiantes', label: 'Estudiantes', align: 'right' },
                { key: 'manos_levantadas_media', label: 'Manos lev.', align: 'right' },
                { key: 'recursos_visitados_media', label: 'Recursos vis.', align: 'right' },
                { key: 'anuncios_vistos_media', label: 'Anuncios vis.', align: 'right' },
                { key: 'discusiones_media', label: 'Discusiones', align: 'right' },
                { key: 'participacion_media', label: 'Índice', align: 'right' },
              ]}
            />
          }
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.req10_participacion_clase} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="clase" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="manos_levantadas_media" name="Manos levantadas" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recursos_visitados_media" name="Recursos visitados" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="anuncios_vistos_media" name="Anuncios vistos" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="discusiones_media" name="Discusiones" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Req 10a: Interactive Factor Explorer */}
      <ChartCard
        badge="Req. 10"
        title="Factores determinantes del éxito académico"
        subtitle="Explora cómo varía el porcentaje de desempeño Alto y Bajo según cada factor socioacadémico"
        headerRight={
          <div className="flex flex-wrap gap-1">
            {factoresDisponibles.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFactor(f)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedFactor === f
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }
        tableContent={
          <DataTable
            rows={data.req10_factores}
            searchable
            exportFilename="req10_factores_exito.csv"
            columns={[
              { key: 'factor', label: 'Factor' },
              { key: 'categoria', label: 'Categoría' },
              { key: 'estudiantes', label: 'Estudiantes', align: 'right' },
              { key: 'promedio_puntaje', label: 'Promedio', align: 'right' },
              { key: 'pct_alto', label: '% Alto', align: 'right' },
              { key: 'pct_bajo', label: '% Bajo', align: 'right' },
              { key: 'participacion_media', label: 'Participación', align: 'right' },
            ]}
          />
        }
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={factorRows} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="categoria" tick={{ fontSize: 12, fill: '#334155' }} />
              <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pct_alto" name="% Desempeño Alto (H)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={64} />
              <Bar dataKey="pct_bajo" name="% Desempeño Bajo (L)" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Req 10c: Pearson Correlations matching Power BI */}
      {data.req10_correlaciones && data.req10_correlaciones.length > 0 && (
        <ChartCard
          badge="Req. 10 · Correlación"
          title="Correlación de Pearson con el puntaje académico (escala 1–5)"
          subtitle="Intensidad de la relación lineal (r) entre cada variable de participación y el rendimiento"
          tableContent={
            <DataTable
              rows={data.req10_correlaciones}
              exportFilename="req10_correlaciones_pearson.csv"
              columns={[
                { key: 'variable', label: 'Variable de participación' },
                { key: 'correlacion', label: 'Correlación (r)', align: 'right' },
              ]}
            />
          }
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.req10_correlaciones}
                layout="vertical"
                margin={{ top: 8, right: 28, left: 20, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis type="category" dataKey="variable" width={130} tick={{ fontSize: 12, fill: '#334155' }} />
                <Tooltip formatter={(v: number) => [v.toFixed(2), 'Correlación (r)']} />
                <Bar dataKey="correlacion" name="Correlación (r)" fill="#4f46e5" radius={[0, 6, 6, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}
    </div>
  )
}
