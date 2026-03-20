import Link from 'next/link'

interface AnalysisItem {
  id: string
  filename: string
  sheetName: string | null
  rowCount: number
  analysedAt: string
}

interface AnalysisHistoryProps {
  analyses: AnalysisItem[]
}

export default function AnalysisHistory({ analyses }: AnalysisHistoryProps) {
  if (analyses.length === 0) {
    return (
      <div data-testid="analysis-history-empty" className="text-center py-10 text-gray-400 text-sm">
        No analyses yet — upload your first Excel file above.
      </div>
    )
  }

  return (
    <div data-testid="analysis-history">
      <h2 className="text-base font-semibold text-gray-900 mb-3">Past Analyses</h2>
      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
        {analyses.map((a) => (
          <li key={a.id}>
            <Link
              href={`/insights/${a.id}`}
              data-testid={`analysis-item-${a.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{a.filename}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {a.rowCount} rows{a.sheetName ? ` · ${a.sheetName}` : ''} ·{' '}
                  {new Date(a.analysedAt).toLocaleDateString()}
                </p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
