import type { AnovaOptionsResponse, AnovaResult, DashboardBundle, EtlControlRow } from '../types/analytics'

const API_BASE = '/api/v1'

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    let detail = `Error HTTP ${response.status}`
    try {
      const err = await response.json()
      if (err?.detail) detail = String(err.detail)
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export const api = {
  getHealth: () => fetchJson<{ status: string; database: string; total_estudiantes: number }>('/health'),
  getDashboard: () => fetchJson<DashboardBundle>('/dashboard'),
  getEtlHistory: () => fetchJson<{ filas: EtlControlRow[] }>('/etl-control'),
  getView: (viewKey: string) =>
    fetchJson<{ vista: string; total: number; filas: Record<string, unknown>[] }>(`/vistas/${viewKey}`),
  getAnovaOptions: () => fetchJson<AnovaOptionsResponse>('/anova/opciones'),
  runAnova: (grupo: string, metrica: string, alpha = 0.05) =>
    fetchJson<AnovaResult>(
      `/anova?grupo=${encodeURIComponent(grupo)}&metrica=${encodeURIComponent(metrica)}&alpha=${alpha}`
    ),
  uploadCsv: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch(`${API_BASE}/ingesta/csv`, {
      method: 'POST',
      body: form,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.detail || `Error HTTP ${response.status}`)
    }
    return payload as {
      estado: string
      id_ejecucion: number
      archivo: string
      filas_cargadas: number
      duplicados_detectados: number
      reglas_validadas: number
      cloudwatch_publicado: boolean
    }
  },
  restoreOriginal: async () => {
    const response = await fetch(`${API_BASE}/ingesta/restaurar`, { method: 'POST' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.detail || `Error HTTP ${response.status}`)
    }
    return payload as {
      estado: string
      id_ejecucion: number
      archivo: string
      filas_cargadas: number
    }
  },
}
