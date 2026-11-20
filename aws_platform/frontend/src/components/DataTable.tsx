import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from 'lucide-react'

export interface ColumnDef<T> {
  key: keyof T & string
  label: string
  align?: 'left' | 'right' | 'center'
  render?: (value: T[keyof T], row: T) => React.ReactNode
}

interface DataTableProps<T extends object> {
  rows: T[]
  columns: ColumnDef<T>[]
  searchable?: boolean
  exportFilename?: string
  maxHeightClass?: string
  pageSize?: number
}

export function DataTable<T extends object>({
  rows,
  columns,
  searchable = false,
  exportFilename,
  maxHeightClass = 'max-h-[440px]',
  pageSize,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.toLowerCase()
    return rows.filter((row) =>
      columns.some((col) => {
        const val = (row as Record<string, unknown>)[col.key]
        return val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      })
    )
  }, [rows, columns, query])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey]
      const bv = (b as Record<string, unknown>)[sortKey]
      if (av === bv) return 0
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const currentPage = Math.min(page, totalPages)
  const visibleRows = pageSize ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize) : sorted

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const exportCsv = () => {
    const header = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',')
    const body = sorted
      .map((row) =>
        columns
          .map((c) => {
            const val = (row as Record<string, unknown>)[c.key]
            const str = val === null || val === undefined ? '' : String(val)
            return `"${str.replace(/"/g, '""')}"`
          })
          .join(',')
      )
      .join('\n')
    const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFilename || 'datos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      {(searchable || exportFilename) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {searchable ? (
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="Buscar en la tabla..."
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 tabular-nums">{sorted.length} registros</span>
            {exportFilename && (
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`overflow-auto rounded-lg border border-slate-200 ${maxHeightClass}`}>
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key
                const alignClass =
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                return (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`cursor-pointer select-none whitespace-nowrap px-3.5 py-2.5 font-semibold text-slate-600 hover:text-slate-900 ${alignClass}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {isSorted ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-indigo-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-indigo-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-300" />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                  Sin registros que coincidan con el filtro.
                </td>
              </tr>
            ) : (
              visibleRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/75">
                  {columns.map((col) => {
                    const rawVal = (row as Record<string, unknown>)[col.key] as T[keyof T]
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right tabular-nums'
                        : col.align === 'center'
                          ? 'text-center tabular-nums'
                          : 'text-left'
                    return (
                      <td key={col.key} className={`whitespace-nowrap px-3.5 py-2 text-slate-700 ${alignClass}`}>
                        {col.render ? col.render(rawVal, row) : String(rawVal ?? '—')}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageSize && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
