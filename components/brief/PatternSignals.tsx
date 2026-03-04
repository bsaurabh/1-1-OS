interface BriefPattern {
  description: string
  severity: 'WATCH' | 'ACTION_REQUIRED'
  meetingCount: number
}

interface PatternSignalsProps {
  patterns: BriefPattern[]
}

const SEVERITY_CONFIG = {
  WATCH: { label: 'Watch', bg: 'bg-amber-100', text: 'text-amber-800' },
  ACTION_REQUIRED: { label: 'Action Required', bg: 'bg-red-100', text: 'text-red-800' },
}

export default function PatternSignals({ patterns }: PatternSignalsProps) {
  if (patterns.length === 0) {
    return (
      <p data-testid="pattern-signals" className="text-sm text-gray-500 italic">
        No active pattern signals.
      </p>
    )
  }

  return (
    <ul data-testid="pattern-signals" className="space-y-2">
      {patterns.map((p, i) => {
        const config = SEVERITY_CONFIG[p.severity]
        return (
          <li key={i} data-testid={`pattern-signal-${i}`} className="flex items-start gap-2 text-sm">
            <span
              className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded shrink-0 ${config.bg} ${config.text}`}
            >
              {config.label}
            </span>
            <span className="text-gray-800">{p.description}</span>
          </li>
        )
      })}
    </ul>
  )
}
