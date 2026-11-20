export interface ResumenGeneral {
  estudiantes: number
  promedio_puntaje: number
  pct_reprobados: number
  pct_sobresalientes: number
  pct_riesgo_desercion: number
  participacion_media: number
}

export interface EtlControlRow {
  id_ejecucion: number
  fecha_ejecucion: string
  archivo_origen: string
  filas_leidas: number
  duplicados_detectados: number
  duplicados_eliminados: number
  filas_cargadas: number
  estado: string
}

export interface Req01Row {
  asignatura: string
  semestre: string
  estudiantes: number
  promedio_puntaje: number
}

export interface Req02Row {
  facultad: string
  estudiantes: number
  en_riesgo: number
  tasa_riesgo_pct: number
}

export interface Req03Row {
  genero: string
  estudiantes: number
  promedio_puntaje: number
  bajo: number
  medio: number
  alto: number
  pct_bajo: number
  pct_medio: number
  pct_alto: number
}

export interface Req04Row {
  nivel_educativo: string
  grado: string
  estudiantes: number
  promedio_puntaje: number
  bajo: number
  medio: number
  alto: number
  pct_bajo: number
  pct_medio: number
  pct_alto: number
}

export interface Req05SemestreRow {
  semestre: string
  estudiantes: number
  promedio_puntaje: number
  pct_bajo: number
  pct_medio: number
  pct_alto: number
}

export interface Req05SemestreNivelRow {
  semestre: string
  nivel_educativo: string
  estudiantes: number
  promedio_puntaje: number
}

export interface Req06Row {
  posicion: number
  asignatura: string
  estudiantes: number
  reprobados: number
  pct_reprobacion: number
}

export interface Req07Row {
  ausencias: string
  estudiantes: number
  promedio_puntaje: number
  participacion_media: number
  bajo: number
  medio: number
  alto: number
  pct_bajo: number
  pct_medio: number
  pct_alto: number
}

export interface Req08Row {
  id_registro: number
  asignatura: string
  facultad: string
  nivel_educativo: string
  grado: string
  genero: string
  semestre: string
  ausencias: string
  manos_levantadas: number
  recursos_visitados: number
  anuncios_vistos: number
  discusiones: number
  indice_participacion: number
}

export interface Req09Row {
  cohorte_grado: string
  estudiantes: number
  promedio_puntaje: number
  bajo: number
  medio: number
  alto: number
  pct_bajo: number
  pct_medio: number
  pct_alto: number
}

export interface Req10FactorRow {
  factor: string
  categoria: string
  estudiantes: number
  promedio_puntaje: number
  pct_alto: number
  pct_bajo: number
  participacion_media: number
}

export interface Req10ParticipacionRow {
  clase: string
  estudiantes: number
  manos_levantadas_media: number
  recursos_visitados_media: number
  anuncios_vistos_media: number
  discusiones_media: number
  participacion_media: number
}

export interface Req10CorrelacionRow {
  variable: string
  correlacion: number
}

export interface DashboardBundle {
  resumen: ResumenGeneral
  etl_ultimo: EtlControlRow | null
  req01_materia_semestre: Req01Row[]
  req02_desercion_facultad: Req02Row[]
  req03_desempeno_genero: Req03Row[]
  req04_programas: Req04Row[]
  req05_semestre: Req05SemestreRow[]
  req05_semestre_nivel: Req05SemestreNivelRow[]
  req06_top10_reprobacion: Req06Row[]
  req07_asistencia_rendimiento: Req07Row[]
  req08_sobresalientes: Req08Row[]
  req09_cohortes: Req09Row[]
  req10_factores: Req10FactorRow[]
  req10_participacion_clase: Req10ParticipacionRow[]
  req10_correlaciones: Req10CorrelacionRow[]
}

export interface AnovaOption {
  clave: string
  etiqueta: string
}

export interface AnovaOptionsResponse {
  grupos: AnovaOption[]
  metricas: AnovaOption[]
}

export interface AnovaGroupStat {
  grupo: string
  n: number
  media: number
  desviacion_std: number
  error_std: number
  ic95_inf: number
  ic95_sup: number
  minimo: number
  q1: number
  mediana: number
  q3: number
  maximo: number
}

export interface AnovaNormalityRow {
  grupo: string
  n: number
  estadistico_w: number | null
  p_valor: number | null
  cumple: boolean
  interpretacion: string
}

export interface AnovaTukeyRow {
  grupo_a: string
  grupo_b: string
  diferencia_medias: number
  ic95_inf: number
  ic95_sup: number
  p_valor: number
  significativo: boolean
}

export interface AnovaResult {
  configuracion: {
    variable_categorica: string
    etiqueta_categorica: string
    variable_numerica: string
    etiqueta_numerica: string
    alpha: number
    total_observaciones: number
    num_grupos: number
    grupos_excluidos: string[]
    media_global: number
  }
  hipotesis: {
    h0: string
    h1: string
  }
  supuestos: {
    normalidad_global: boolean
    normalidad_por_grupo: AnovaNormalityRow[]
    homogeneidad_levene: {
      estadistico: number
      p_valor: number
      cumple: boolean
      interpretacion: string
    }
    nota_metodologica: string
  }
  anova: {
    f_estadistico: number
    p_valor: number
    df_entre: number
    df_dentro: number
    df_total: number
    ss_entre: number
    ss_dentro: number
    ss_total: number
    ms_entre: number
    ms_dentro: number
    eta_cuadrado: number
    tamano_efecto: string
    rechaza_h0: boolean
    decision: string
  }
  pruebas_complementarias: {
    welch_anova: {
      f_estadistico: number | null
      df1: number | null
      df2: number | null
      p_valor: number | null
      significativo: boolean | null
    }
    kruskal_wallis: {
      h_estadistico: number
      p_valor: number
      significativo: boolean
    }
  }
  grupos: AnovaGroupStat[]
  posthoc_tukey: AnovaTukeyRow[]
  conclusion: string
}
