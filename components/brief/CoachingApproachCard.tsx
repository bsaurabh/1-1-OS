interface CoachingApproach {
  framework: string
  rationale: string
  actions: string[]
}

interface CoachingApproachCardProps {
  approach: CoachingApproach
}

export default function CoachingApproachCard({ approach }: CoachingApproachCardProps) {
  return (
    <div data-testid="coaching-approach-card" className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span
          data-testid="coaching-framework-name"
          className="inline-block px-2 py-0.5 bg-indigo-600 text-white text-xs font-semibold rounded"
        >
          {approach.framework} Framework
        </span>
      </div>
      <p data-testid="coaching-rationale" className="text-sm text-gray-700">
        {approach.rationale}
      </p>
      {approach.actions.length > 0 && (
        <ul className="space-y-1">
          {approach.actions.map((action, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="text-indigo-400 shrink-0">•</span>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
