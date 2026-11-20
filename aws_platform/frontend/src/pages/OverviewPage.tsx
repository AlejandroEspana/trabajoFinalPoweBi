import { useRef, useState } from 'react'
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  GraduationCap,
  RotateCcw,
  TrendingUp,
  Upload,
  UserX,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartCard } from '../components/ChartCard'
import { KpiCard } from '../components/KpiCard'
import { api } from '../services/api'
import type { DashboardBundle } from '../types/analytics'

interface OverviewPageProps {
  data: DashboardBundle
}

const COLORS = {
  indigo: '#4f46e5',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#0ea5e9',
}

export function OverviewPage({ data }: OverviewPageProps) {
  const { resumen, etl_ultimo } = data
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setFeedback(null)
    try {
      const res = await api.uploadCsv(file)
      setFeedback({
        type: 'ok',
        text: `Cargadas ${res.filas_cargadas} filas (${res.reglas_validadas}/36 reglas OK, ETL #${res.id_ejecucion})${res.cloudwatch_publicado ? ' · CloudWatch actualizado' : ''}`,
      })
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Error subiendo CSV' })
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async () => {
    setBusy(true)
    setFeedback(null)
    try {
      const res = await api.restoreOriginal()
      setFeedback({
        type: 'ok',
        text: `Dataset original restaurado (${res.filas_cargadas} filas, ETL #${res.id_ejecucion})`,
      })
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Error restaurando dataset' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Estudiantes"
          value={resumen.estudiantes}
          subtitle="Registros validados"
          accent="indigo"
          icon={<Users className="h-5 w-5" />}
        />
        <KpiCard
          label="Puntaje Promedio"
          value={`${resumen.promedio_puntaje.toFixed(2)} / 5`}
          subtitle="Escala 1–5 (L=1, M=3, H=5)"
          accent="sky"
          icon={<GraduationCap className="h-5 w-5" />}
        />
        <KpiCard
          label="Sobresalientes"
          value={`${resumen.pct_sobresalientes.toFixed(1)}%`}
          subtitle={`${data.req08_sobresalientes.length} estudiantes (Clase H)`}
          accent="emerald"
          icon={<Award className="h-5 w-5" />}
        />
        <KpiCard
          label="Reprobación"
          value={`${resumen.pct_reprobados.toFixed(1)}%`}
          subtitle="Desempeño bajo (Clase L)"
          accent="amber"
          icon={<UserX className="h-5 w-5" />}
        />
        <KpiCard
          label="Riesgo Deserción"
          value={`${resumen.pct_riesgo_desercion.toFixed(1)}%`}
          subtitle="Clase L + >7 ausencias"
          accent="rose"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KpiCard
          label="Participación Media"
          value={`${(resumen.participacion_media * 100).toFixed(1)}%`}
          subtitle={`Índice ${resumen.participacion_media.toFixed(4)}`}
          accent="slate"
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Main Executive Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          badge="Req. 2"
          title="Tasa de riesgo de deserción por facultad"
          subtitle="Porcentaje de estudiantes en clase Bajo con más de 7 ausencias"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.req02_desercion_facultad} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="facultad" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'tasa_riesgo_pct' ? `${value}%` : value,
                    name === 'tasa_riesgo_pct' ? 'Tasa de riesgo' : name,
                  ]}
                />
                <Bar dataKey="tasa_riesgo_pct" name="Tasa de riesgo (%)" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {data.req02_desercion_facultad.map((_, idx) => (
                    <Cell key={idx} fill={idx === 0 ? COLORS.rose : idx === 1 ? COLORS.amber : COLORS.indigo} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          badge="Req. 7"
          title="Impacto de la asistencia en el rendimiento"
          subtitle="Distribución porcentual de rendimiento según ausencias acumuladas"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.req07_asistencia_rendimiento} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="ausencias" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pct_bajo" stackId="a" name="% Bajo (L)" fill={COLORS.rose} />
                <Bar dataKey="pct_medio" stackId="a" name="% Medio (M)" fill={COLORS.amber} />
                <Bar dataKey="pct_alto" stackId="a" name="% Alto (H)" fill={COLORS.emerald} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Bottom Row: Top Reprobación + ETL Audit */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            badge="Req. 6"
            title="Top 10 asignaturas con mayor tasa de reprobación"
            subtitle="Ordenado por porcentaje de estudiantes en clase Bajo (reprobado)"
          >
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.req06_top10_reprobacion}
                  layout="vertical"
                  margin={{ top: 5, right: 24, left: 12, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis type="category" dataKey="asignatura" width={88} tick={{ fontSize: 11, fill: '#334155' }} />
                  <Tooltip formatter={(val: number) => [`${val}%`, '% Reprobación']} />
                  <Bar dataKey="pct_reprobacion" name="% Reprobación" fill={COLORS.rose} radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <ChartCard
          badge="ETL PySpark"
          title="Auditoría de carga de datos"
          subtitle="Trazabilidad desde academico.etl_control"
        >
          {etl_ultimo ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                Última ejecución #{etl_ultimo.id_ejecucion} finalizada con estado {etl_ultimo.estado}
              </div>

              <dl className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Archivo origen</dt>
                  <dd className="font-mono font-medium text-slate-800">{etl_ultimo.archivo_origen}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Filas leídas</dt>
                  <dd className="font-semibold tabular-nums text-slate-800">{etl_ultimo.filas_leidas}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Filas cargadas</dt>
                  <dd className="font-semibold tabular-nums text-emerald-700">{etl_ultimo.filas_cargadas}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Duplicados detectados</dt>
                  <dd className="font-semibold tabular-nums text-amber-700">{etl_ultimo.duplicados_detectados}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Duplicados eliminados</dt>
                  <dd className="font-semibold tabular-nums text-slate-800">{etl_ultimo.duplicados_eliminados}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Fecha de carga</dt>
                  <dd className="font-medium text-slate-700">
                    {new Date(etl_ultimo.fecha_ejecucion).toLocaleString('es-CO')}
                  </dd>
                </div>
              </dl>

              <div className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-200/70">
                <p className="font-semibold text-slate-800">Supuestos documentados del ETL:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>Puntaje académico (escala 1–5): Bajo=1, Medio=3, Alto=5 (unificada con Power BI).</li>
                  <li>Facultad: agrupación temática de 12 asignaturas.</li>
                  <li>Riesgo de deserción: proxy (Clase L + &gt;7 ausencias).</li>
                  <li>Cohorte: aproximada por grado escolar (G-02 a G-12).</li>
                </ul>
              </div>

              {/* Live ETL CSV Ingestion Controls */}
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[11px] font-semibold text-slate-700">Actualización en tiempo real (PostgreSQL + SSE + CloudWatch)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {busy ? 'Validando y cargando...' : 'Cargar CSV nuevo'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleRestore}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar 480
                  </button>
                </div>
                {feedback && (
                  <p
                    className={`mt-2 rounded-lg px-2.5 py-2 text-[11px] font-medium ${
                      feedback.type === 'ok'
                        ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                        : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
                    }`}
                  >
                    {feedback.text}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">No hay registros en academico.etl_control.</p>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
