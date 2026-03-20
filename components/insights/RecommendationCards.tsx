interface RecommendationCardsProps {
  recommendations: string[]
}

export default function RecommendationCards({ recommendations }: RecommendationCardsProps) {
  if (recommendations.length === 0) return null

  return (
    <div data-testid="recommendation-cards">
      <h2 className="text-base font-semibold text-gray-900 mb-3">Data Recommendations</h2>
      <div className="space-y-2">
        {recommendations.map((rec, i) => (
          <div
            key={i}
            data-testid={`recommendation-card-${i}`}
            className="flex gap-3 bg-amber-50 border border-amber-100 rounded-lg p-4"
          >
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
