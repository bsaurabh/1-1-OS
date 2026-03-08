import Link from 'next/link'

interface CritiqueListItem {
  id: string
  featureName: string
  status: string
  stage: string
  clarityScore: number | null
  createdAt: string
}

interface Props {
  critiques: CritiqueListItem[]
  onNewClick: () => void
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-600',
    ANALYZING: 'bg-amber-100 text-amber-700',
    COMPLETE: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-600',
  }
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  )
}

export default function CritiqueList({ critiques, onNewClick }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Design Critique</h1>
          <p className="text-sm text-gray-500 mt-1">AI-powered design review and feedback</p>
        </div>
        <button
          onClick={onNewClick}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + New Critique
        </button>
      </div>

      {critiques.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400 text-4xl mb-3">&#128065;</div>
          <p className="text-sm text-gray-600 mb-2">No critiques yet</p>
          <p className="text-xs text-gray-400 mb-4">Start your first AI design critique to get structured, principle-driven feedback.</p>
          <button
            onClick={onNewClick}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Start New Critique
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {critiques.map((c) => (
            <Link
              key={c.id}
              href={`/critique/${c.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{c.featureName}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(c.createdAt).toLocaleDateString()} &middot; {c.stage === 'FINAL_POLISH' ? 'Final Polish' : 'Exploratory'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {c.clarityScore !== null && (
                    <span className={`text-sm font-bold ${
                      c.clarityScore >= 80 ? 'text-green-600' : c.clarityScore >= 60 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {c.clarityScore}
                    </span>
                  )}
                  <StatusBadge status={c.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <span className="inline-block text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
          Beta
        </span>
      </div>
    </div>
  )
}
