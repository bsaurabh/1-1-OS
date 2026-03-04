interface GrowthSummary {
  teammateName: string
  generatedAt: string
  narrative: string
  keyThemes: string[]
  growthSignals: string[]
  coachingGaps: string[]
}

interface GrowthSummaryPanelProps {
  summary: GrowthSummary | null
  isLoading: boolean
  hasAttempted: boolean
  onGenerate: () => void
}

export default function GrowthSummaryPanel({
  summary,
  isLoading,
  hasAttempted,
  onGenerate,
}: GrowthSummaryPanelProps) {
  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="growth-summary-panel"
        className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 mb-4 flex items-center gap-3"
      >
        <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
        <span className="text-sm text-indigo-700">Generating summary…</span>
      </div>
    )
  }

  // Error / null after attempt
  if (hasAttempted && !summary) {
    return (
      <div
        data-testid="growth-summary-panel"
        className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4"
      >
        <p className="text-sm text-gray-600 mb-2">
          Growth summary unavailable. Try again later.
        </p>
        <button
          data-testid="generate-summary-btn"
          onClick={onGenerate}
          className="text-sm text-indigo-600 hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  // Loaded
  if (summary) {
    return (
      <div
        data-testid="growth-summary-panel"
        className="rounded-lg border border-indigo-200 bg-indigo-50 p-5 mb-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-indigo-900">Growth Summary</h2>
          <span className="text-xs text-indigo-500">
            {new Date(summary.generatedAt).toLocaleDateString()}
          </span>
        </div>

        <p
          data-testid="summary-narrative"
          className="text-sm text-gray-800 mb-4 leading-relaxed"
        >
          {summary.narrative}
        </p>

        <div data-testid="summary-themes" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {summary.keyThemes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-indigo-700 mb-1">Key Themes</h3>
              <ul className="text-xs text-gray-700 space-y-0.5">
                {summary.keyThemes.map((t, i) => <li key={i}>• {t}</li>)}
              </ul>
            </div>
          )}
          {summary.growthSignals.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-green-700 mb-1">Growth Signals</h3>
              <ul className="text-xs text-gray-700 space-y-0.5">
                {summary.growthSignals.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
          )}
          {summary.coachingGaps.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-amber-700 mb-1">Coaching Gaps</h3>
              <ul className="text-xs text-gray-700 space-y-0.5">
                {summary.coachingGaps.map((g, i) => <li key={i}>• {g}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Not yet generated
  return (
    <div className="mb-4">
      <button
        data-testid="generate-summary-btn"
        onClick={onGenerate}
        className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
      >
        Generate Growth Summary
      </button>
    </div>
  )
}
