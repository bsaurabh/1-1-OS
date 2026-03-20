interface InsightCardsProps {
  insights: string[]
}

export default function InsightCards({ insights }: InsightCardsProps) {
  if (insights.length === 0) return null

  return (
    <div data-testid="insight-cards">
      <h2 className="text-base font-semibold text-gray-900 mb-3">Key Insights</h2>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            data-testid={`insight-card-${i}`}
            className="flex gap-3 bg-indigo-50 border border-indigo-100 rounded-lg p-4"
          >
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <p className="text-sm text-gray-800 leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
