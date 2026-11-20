import { useEffect, useState } from 'react'
import { ChartCard } from '../components/ChartCard'
import { DataTable, type ColumnDef } from '../components/DataTable'
import { api } from '../services/api'
import type { DashboardBundle, Req08Row } from '../types/analytics'

interface StudentsTablePageProps {
  data: DashboardBundle
}

const VIEW_CATALOG = [
  { key: 'v_resumen_general', label: 'v_resumen_general (KPIs)' },
  { key: 'v_req01_promedio_materia_semestre', label: 'Req. 1 · Promedio materia y semestre' },
  { key: 'v_req02_desercion_facultad', label: 'Req. 2 · Deserción por facultad' },
  { key: 'v_req03_desempeno_genero', label: 'Req. 3 · Desempeño por género' },
  { key: 'v_req04_programas', label: 'Req. 4 · Programas (nivel y grado)' },
  { key: 'v_req05_semestre', label: 'Req. 5 · Tendencia por semestre' },
  { key: 'v_req05_semestre_nivel', label: 'Req. 5b · Semestre por nivel' },
  { key: 'v_req06_top10_reprobacion', label: 'Req. 6 · Top 10 reprobación' },
  { key: 'v_req07_asistencia_rendimiento', label: 'Req. 7 · Asistencia y rendimiento' },
  { key: 'v_req08_sobresalientes', label: 'Req. 8 · Estudiantes sobresalientes' },
  { key: 'v_req09_cohortes', label: 'Req. 9 · Cohortes (grado)' },
  { key: 'v_req10_factores', label: 'Req. 10 · Factores de éxito' },
  { key: 'v_req10_participacion_clase', label: 'Req. 10b · Participación por clase' },
  { key: 'etl_control', label: 'Auditoría · academico.etl_control' },
]

export function StudentsTablePage({ data }: StudentsTablePageProps) {
  const [selectedView, setSelectedView] = useState('v_req01_promedio_materia_semestre')
  const [viewRows, setViewRows] = useState<Record<string, unknown>[]>([])
  const [loadingView, setLoadingView] = useState(false)

  useEffect(() => {
    let active = true
    setLoadingView(true)
    api
      .getView(selectedView)
      .then((res) => {
        if (active) setViewRows(res.filas)
      })
      .finally(() => {
        if (active) setLoadingView(false)
      })
    return () => {
      active = false
    }
  }, [selectedView])

  const dynamicColumns: ColumnDef<Record<string, unknown>>[] =
    viewRows.length > 0
      ? Object.keys(viewRows[0]).map((k) => ({
          key: k,
          label: k.replace(/_/g, ' '),
          align: typeof viewRows[0][k] === 'number' ? 'right' : 'left',
        }))
      : []

  const req08Columns: ColumnDef<Req08Row>[] = [
    { key: 'id_registro', label: 'ID', align: 'right' },
    { key: 'asignatura', label: 'Asignatura' },
    { key: 'facultad', label: 'Facultad' },
    { key: 'nivel_educativo', label: 'Nivel' },
    { key: 'grado', label: 'Grado' },
    { key: 'genero', label: 'Género' },
    { key: 'semestre', label: 'Semestre' },
    { key: 'ausencias', label: 'Ausencias' },
    { key: 'manos_levantadas', label: 'Manos lev.', align: 'right' },
    { key: 'recursos_visitados', label: 'Recursos', align: 'right' },
    { key: 'anuncios_vistos', label: 'Anuncios', align: 'right' },
    { key: 'discusiones', label: 'Discusiones', align: 'right' },
    {
      key: 'indice_participacion',
      label: 'Índice Part.',
      align: 'right',
      render: (val) => (
        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
          {Number(val).toFixed(4)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Req 8: Outstanding students */}
      <ChartCard
        badge="Req. 8"
        title="Estudiantes con desempeño sobresaliente (Clase Alto)"
        subtitle="Ordenados por índice de participación descendente · Búsqueda, ordenamiento y exportación CSV"
      >
        <DataTable
          rows={data.req08_sobresalientes}
          columns={req08Columns}
          searchable
          exportFilename="req08_estudiantes_sobresalientes.csv"
          pageSize={15}
        />
      </ChartCard>

      {/* SQL Views Explorer */}
      <ChartCard
        badge="PostgreSQL · 14 Vistas"
        title="Explorador directo de vistas SQL (Power BI)"
        subtitle="Consulta en vivo cualquiera de las vistas creadas en academico.* y descárgala en CSV"
        headerRight={
          <select
            value={selectedView}
            onChange={(e) => setSelectedView(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            {VIEW_CATALOG.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        }
      >
        {loadingView ? (
          <p className="py-8 text-center text-xs text-slate-500">Consultando vista en PostgreSQL...</p>
        ) : (
          <DataTable
            rows={viewRows}
            columns={dynamicColumns}
            searchable
            exportFilename={`${selectedView}.csv`}
            pageSize={15}
          />
        )}
      </ChartCard>
    </div>
  )
}
