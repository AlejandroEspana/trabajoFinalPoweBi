import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  FlaskConical,
  Info,
  Scale,
  Sigma,
  Sparkles,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartCard } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { KpiCard } from '../components/KpiCard'
import { api } from '../services/api'
import type { AnovaResult } from '../types/analytics'

interface AnovaCase {
  id: string
  badge: string
  titulo: string
  pregunta: string
  h0: string
  h1: string
  grupo: string
  metrica: string
}

const ANOVA_CASES: AnovaCase[] = [
  {
    id: 'anova1',
    badge: 'ANOVA 1',
    titulo: 'Rendimiento por nivel educativo',
    pregunta: '¿El promedio de rendimiento es diferente entre los niveles educativos?',
    h0: 'Los tres niveles educativos (Primaria, Secundaria y Bachillerato) tienen el mismo promedio de rendimiento.',
    h1: 'Al menos uno de los niveles educativos tiene un promedio de rendimiento diferente.',
    grupo: 'nivel_educativo',
    metrica: 'puntaje_ordinal',
  },
  {
    id: 'anova2',
    badge: 'ANOVA 2',
    titulo: 'Rendimiento por facultad',
    pregunta: '¿Existen diferencias significativas en el rendimiento académico entre facultades?',
    h0: 'Todas las facultades tienen el mismo promedio de rendimiento académico.',
    h1: 'Al menos una facultad tiene un promedio de rendimiento académico diferente.',
    grupo: 'facultad',
    metrica: 'puntaje_ordinal',
  },
  {
    id: 'anova3',
    badge: 'ANOVA 3',
    titulo: 'Rendimiento por asignatura',
    pregunta: '¿El promedio de rendimiento cambia dependiendo de la asignatura?',
    h0: 'Todas las asignaturas tienen el mismo promedio de rendimiento.',
    h1: 'Al menos una asignatura tiene un promedio de rendimiento diferente.',
    grupo: 'asignatura',
    metrica: 'puntaje_ordinal',
  },
  {
    id: 'anova4',
    badge: 'ANOVA 4',
    titulo: 'Participación por nivel de rendimiento',
    pregunta: '¿El índice de participación cambia entre estudiantes con rendimiento bajo, medio y alto?',
    h0: 'Los tres grupos (Bajo, Medio y Alto) tienen el mismo promedio de índice de participación.',
    h1: 'Al menos uno de los grupos tiene un promedio de índice de participación diferente.',
    grupo: 'clase',
    metrica: 'indice_participacion',
  },
]

export function AnovaPage() {
  const [selectedId, setSelectedId] = useState<string>(ANOVA_CASES[0].id)
  const [alpha, setAlpha] = useState(0.05)
  const [result, setResult] = useState<AnovaResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const currentCase = ANOVA_CASES.find((c) => c.id === selectedId) ?? ANOVA_CASES[0]

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .runAnova(currentCase.grupo, currentCase.metrica, alpha)
      .then((res) => {
        if (active) setResult(res)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Error ejecutando ANOVA')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [currentCase.grupo, currentCase.metrica, alpha])

  const copySummary = () => {
    if (!result) return
    const respuestaDirecta = result.anova.rechaza_h0
      ? `SÍ existen diferencias estadísticamente significativas (se rechaza H₀, p = ${result.anova.p_valor} < α = ${alpha}).`
      : `NO existen diferencias estadísticamente significativas (no se rechaza H₀, p = ${result.anova.p_valor} ≥ α = ${alpha}).`

    const text = [
      `${currentCase.badge}. ${currentCase.titulo}`,
      `Pregunta: ${currentCase.pregunta}`,
      `N = ${result.configuracion.total_observaciones} | Grupos (k) = ${result.configuracion.num_grupos} | α = ${alpha}`,
      ``,
      `H0: ${currentCase.h0}`,
      `H1: ${currentCase.h1}`,
      `Respuesta: ${respuestaDirecta}`,
      ``,
      `Supuestos:`,
      `- Normalidad (Shapiro-Wilk global): ${result.supuestos.normalidad_global ? 'Cumple' : 'No cumple en al menos un grupo'}`,
      `- Homogeneidad de varianzas (Levene): W = ${result.supuestos.homogeneidad_levene.estadistico}, p = ${result.supuestos.homogeneidad_levene.p_valor} (${result.supuestos.homogeneidad_levene.interpretacion})`,
      ``,
      `Resultados ANOVA:`,
      `- F(${result.anova.df_entre}, ${result.anova.df_dentro}) = ${result.anova.f_estadistico}`,
      `- p-valor = ${result.anova.p_valor}`,
      `- Tamaño de efecto η² = ${result.anova.eta_cuadrado} (${result.anova.tamano_efecto})`,
      `- Welch ANOVA: F = ${result.pruebas_complementarias.welch_anova.f_estadistico ?? 'N/A'}, p = ${result.pruebas_complementarias.welch_anova.p_valor ?? 'N/A'}`,
      `- Kruskal-Wallis: H = ${result.pruebas_complementarias.kruskal_wallis.h_estadistico}, p = ${result.pruebas_complementarias.kruskal_wallis.p_valor}`,
      ``,
      `Conclusión: ${result.conclusion}`,
    ].join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const chartData =
    result?.grupos.map((g) => ({
      ...g,
      errorY: [
        Number(Math.max(0, g.media - g.ic95_inf).toFixed(4)),
        Number(Math.max(0, g.ic95_sup - g.media).toFixed(4)),
      ] as [number, number],
    })) ?? []

  return (
    <div className="space-y-6">
      {/* Selector of the 4 official ANOVA tests */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-600/15">
                Componente Estadístico Obligatorio
              </span>
              <h2 className="text-base font-bold text-slate-900">Laboratorio ANOVA (4 Pruebas Oficiales)</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Selecciona una de las 4 pruebas ANOVA del estudio para evaluar las hipótesis, supuestos (Shapiro-Wilk y
              Levene), pruebas robustas (Welch / Kruskal-Wallis) y comparaciones Post-Hoc (Tukey HSD).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value={0.01}>α = 0.01 (99%)</option>
              <option value={0.05}>α = 0.05 (95%)</option>
              <option value={0.1}>α = 0.10 (90%)</option>
            </select>

            {result && (
              <button
                type="button"
                onClick={copySummary}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar para informe'}
              </button>
            )}
          </div>
        </div>

        {/* 4 Preset Cards */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ANOVA_CASES.map((item) => {
            const isActive = item.id === currentCase.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`flex flex-col rounded-xl border p-4 text-left transition-all ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <span
                  className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    isActive ? 'bg-indigo-600 text-white' : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
                <p className={`mt-2 text-xs font-bold ${isActive ? 'text-indigo-950' : 'text-slate-900'}`}>
                  {item.titulo}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{item.pregunta}</p>
              </button>
            )
          })}
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && !result && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500">
          Calculando prueba ANOVA, supuestos y Tukey HSD...
        </div>
      )}

      {result && (
        <>
          {/* Research Question + Hypotheses + Direct Answer */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs lg:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">
                {currentCase.badge} · {currentCase.titulo}
              </p>
              <h3 className="mt-1 text-sm font-bold text-slate-900">{currentCase.pregunta}</h3>
              <div className="mt-3 space-y-2 text-xs leading-relaxed">
                <p>
                  <span className="mr-2 inline-flex rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-slate-800">
                    H₀
                  </span>
                  <span className="text-slate-700">{currentCase.h0}</span>
                </p>
                <p>
                  <span className="mr-2 inline-flex rounded bg-indigo-50 px-1.5 py-0.5 font-mono font-bold text-indigo-700">
                    H₁
                  </span>
                  <span className="text-slate-700">{currentCase.h1}</span>
                </p>
              </div>
            </div>

            <div
              className={`flex flex-col justify-between rounded-xl border p-5 shadow-xs ${
                result.anova.rechaza_h0
                  ? 'border-emerald-200 bg-emerald-50/75 text-emerald-950'
                  : 'border-amber-200 bg-amber-50/75 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                {result.anova.rechaza_h0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Info className="h-4 w-4 text-amber-600" />
                )}
                Respuesta a las Hipótesis
              </div>
              <p className="mt-2 text-sm font-bold">
                {result.anova.rechaza_h0
                  ? 'Sí hay diferencias significativas (se rechaza H₀)'
                  : 'No hay diferencias significativas (no se rechaza H₀)'}
              </p>
              <p className="mt-1.5 text-[11px] opacity-90">
                {result.anova.decision} · N = {result.configuracion.total_observaciones} · k ={' '}
                {result.configuracion.num_grupos} grupos
              </p>
            </div>
          </div>

          {/* 4 Statistical KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Estadístico F"
              value={result.anova.f_estadistico.toFixed(4)}
              subtitle={`gl = (${result.anova.df_entre}, ${result.anova.df_dentro})`}
              accent="indigo"
              icon={<Sigma className="h-5 w-5" />}
            />
            <KpiCard
              label="p-valor (ANOVA)"
              value={result.anova.p_valor < 0.0001 ? '< 0.0001' : result.anova.p_valor.toFixed(6)}
              subtitle={result.anova.rechaza_h0 ? `p < α (${alpha}) · Significativo` : `p ≥ α (${alpha}) · No significativo`}
              accent={result.anova.rechaza_h0 ? 'emerald' : 'amber'}
              icon={<FlaskConical className="h-5 w-5" />}
            />
            <KpiCard
              label="Tamaño de Efecto (η²)"
              value={result.anova.eta_cuadrado.toFixed(4)}
              subtitle={`Efecto ${result.anova.tamano_efecto} (${(result.anova.eta_cuadrado * 100).toFixed(1)}% varianza)`}
              accent="sky"
              icon={<Sparkles className="h-5 w-5" />}
            />
            <KpiCard
              label="Kruskal-Wallis (No param.)"
              value={`H = ${result.pruebas_complementarias.kruskal_wallis.h_estadistico.toFixed(2)}`}
              subtitle={`p = ${
                result.pruebas_complementarias.kruskal_wallis.p_valor < 0.0001
                  ? '< 0.0001'
                  : result.pruebas_complementarias.kruskal_wallis.p_valor.toFixed(6)
              }`}
              accent="slate"
              icon={<Scale className="h-5 w-5" />}
            />
          </div>

          {/* Group Means Visualization + Descriptive Table */}
          <ChartCard
            badge="Visualización de Grupos"
            title={`${currentCase.titulo} — Medias con IC al ${Math.round((1 - alpha) * 100)}%`}
            subtitle={`Variable medida: ${result.configuracion.etiqueta_numerica} · Media global: ${result.configuracion.media_global}`}
            tableContent={
              <DataTable
                rows={result.grupos}
                exportFilename={`${currentCase.id}_grupos.csv`}
                columns={[
                  { key: 'grupo', label: 'Grupo' },
                  { key: 'n', label: 'n', align: 'right' },
                  { key: 'media', label: 'Media', align: 'right' },
                  { key: 'desviacion_std', label: 'DE', align: 'right' },
                  { key: 'ic95_inf', label: 'IC Inf', align: 'right' },
                  { key: 'ic95_sup', label: 'IC Sup', align: 'right' },
                  { key: 'minimo', label: 'Mín', align: 'right' },
                  { key: 'q1', label: 'Q1', align: 'right' },
                  { key: 'mediana', label: 'Mediana', align: 'right' },
                  { key: 'q3', label: 'Q3', align: 'right' },
                  { key: 'maximo', label: 'Máx', align: 'right' },
                ]}
              />
            }
          >
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 18, right: 24, left: 4, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="grupo"
                    tick={{ fontSize: 11, fill: '#334155' }}
                    angle={chartData.length > 6 ? -22 : 0}
                    textAnchor={chartData.length > 6 ? 'end' : 'middle'}
                    height={chartData.length > 6 ? 60 : 30}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      typeof val === 'number' ? val.toFixed(4) : val,
                      name === 'media' ? 'Media del grupo' : name,
                    ]}
                  />
                  <ReferenceLine
                    y={result.configuracion.media_global}
                    stroke="#0f172a"
                    strokeDasharray="4 4"
                    label={{
                      value: `Media global: ${result.configuracion.media_global}`,
                      position: 'insideTopRight',
                      fill: '#334155',
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="media" name="Media" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    <ErrorBar dataKey="errorY" width={6} strokeWidth={2} stroke="#0f172a" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* ANOVA Table + Assumptions */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard
              badge="Tabla ANOVA"
              title="Descomposición de varianza y pruebas complementarias"
              subtitle="Suma de cuadrados (SS), grados de libertad (gl), cuadrados medios (MS) y F"
            >
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3.5 py-2.5 text-left font-semibold text-slate-600">Fuente de variación</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold text-slate-600">SS</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold text-slate-600">gl</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold text-slate-600">MS</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold text-slate-600">F</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold text-slate-600">p-valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white tabular-nums">
                      <tr>
                        <td className="px-3.5 py-2.5 font-medium text-slate-800">Entre grupos</td>
                        <td className="px-3.5 py-2.5 text-right">{result.anova.ss_entre}</td>
                        <td className="px-3.5 py-2.5 text-right">{result.anova.df_entre}</td>
                        <td className="px-3.5 py-2.5 text-right">{result.anova.ms_entre}</td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-indigo-700">
                          {result.anova.f_estadistico}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-indigo-700">
                          {result.anova.p_valor}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2.5 font-medium text-slate-800">Dentro de grupos (Error)</td>
                        <td className="px-3.5 py-2.5 text-right">{result.anova.ss_dentro}</td>
                        <td className="px-3.5 py-2.5 text-right">{result.anova.df_dentro}</td>
                        <td className="px-3.5 py-2.5 text-right">{result.anova.ms_dentro}</td>
                        <td className="px-3.5 py-2.5 text-right text-slate-400">—</td>
                        <td className="px-3.5 py-2.5 text-right text-slate-400">—</td>
                      </tr>
                      <tr className="bg-slate-50/70 font-semibold">
                        <td className="px-3.5 py-2.5 text-slate-900">Total</td>
                        <td className="px-3.5 py-2.5 text-right">{result.anova.ss_total}</td>
                        <td className="px-3.5 py-2.5 text-right">{result.anova.df_total}</td>
                        <td className="px-3.5 py-2.5 text-right text-slate-400">—</td>
                        <td className="px-3.5 py-2.5 text-right text-slate-400">—</td>
                        <td className="px-3.5 py-2.5 text-right text-slate-400">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200/70">
                    <p className="font-semibold text-slate-800">Welch ANOVA (varianzas desiguales)</p>
                    <p className="mt-1 tabular-nums text-slate-600">
                      F = {result.pruebas_complementarias.welch_anova.f_estadistico ?? 'N/A'} · p ={' '}
                      {result.pruebas_complementarias.welch_anova.p_valor ?? 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200/70">
                    <p className="font-semibold text-slate-800">Kruskal-Wallis (no paramétrica)</p>
                    <p className="mt-1 tabular-nums text-slate-600">
                      H = {result.pruebas_complementarias.kruskal_wallis.h_estadistico} · p ={' '}
                      {result.pruebas_complementarias.kruskal_wallis.p_valor}
                    </p>
                  </div>
                </div>
              </div>
            </ChartCard>

            <ChartCard
              badge="Supuestos"
              title="Normalidad (Shapiro-Wilk) y Homogeneidad de varianzas (Levene)"
              subtitle="Validación rigurosa de los requisitos del modelo ANOVA"
            >
              <div className="space-y-4">
                <div
                  className={`flex items-center justify-between gap-3 rounded-lg p-3 text-xs ring-1 ${
                    result.supuestos.homogeneidad_levene.cumple
                      ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
                      : 'bg-amber-50 text-amber-900 ring-amber-200'
                  }`}
                >
                  <div>
                    <p className="font-semibold">Prueba de Levene (Homogeneidad de varianzas)</p>
                    <p className="mt-0.5 opacity-90">{result.supuestos.homogeneidad_levene.interpretacion}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-bold">W = {result.supuestos.homogeneidad_levene.estadistico}</p>
                    <p>p = {result.supuestos.homogeneidad_levene.p_valor}</p>
                  </div>
                </div>

                <DataTable
                  rows={result.supuestos.normalidad_por_grupo}
                  maxHeightClass="max-h-56"
                  columns={[
                    { key: 'grupo', label: 'Grupo' },
                    { key: 'n', label: 'n', align: 'right' },
                    { key: 'estadistico_w', label: 'Shapiro W', align: 'right' },
                    { key: 'p_valor', label: 'p-valor', align: 'right' },
                    {
                      key: 'cumple',
                      label: 'Normalidad',
                      align: 'center',
                      render: (v) =>
                        v ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                            Cumple
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-600/20">
                            No cumple
                          </span>
                        ),
                    },
                  ]}
                />

                <p className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-200/70">
                  <span className="font-semibold text-slate-800">Nota metodológica: </span>
                  {result.supuestos.nota_metodologica}
                </p>
              </div>
            </ChartCard>
          </div>

          {/* Post-Hoc Tukey HSD + Conclusion */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ChartCard
                badge="Post-Hoc"
                title="Comparaciones múltiples Tukey HSD"
                subtitle="Identifica qué pares específicos de grupos presentan diferencias significativas"
              >
                <DataTable
                  rows={result.posthoc_tukey}
                  searchable={result.posthoc_tukey.length > 8}
                  exportFilename={`tukey_${currentCase.id}.csv`}
                  pageSize={10}
                  columns={[
                    { key: 'grupo_a', label: 'Grupo A' },
                    { key: 'grupo_b', label: 'Grupo B' },
                    { key: 'diferencia_medias', label: 'Dif. Medias (A−B)', align: 'right' },
                    { key: 'ic95_inf', label: 'IC Inf', align: 'right' },
                    { key: 'ic95_sup', label: 'IC Sup', align: 'right' },
                    { key: 'p_valor', label: 'p-ajustado', align: 'right' },
                    {
                      key: 'significativo',
                      label: 'Resultado',
                      align: 'center',
                      render: (v) =>
                        v ? (
                          <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-600/20">
                            Significativo
                          </span>
                        ) : (
                          <span className="text-slate-400">No sig.</span>
                        ),
                    },
                  ]}
                />
              </ChartCard>
            </div>

            <ChartCard
              badge="Conclusión"
              title="Interpretación para el informe técnico"
              subtitle="Síntesis estadística automática basada en los resultados"
            >
              <div className="space-y-3 text-xs leading-relaxed text-slate-700">
                <p className="rounded-lg bg-indigo-50/60 p-3.5 text-slate-800 ring-1 ring-indigo-100">
                  {result.conclusion}
                </p>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}
