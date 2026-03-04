import PatternCard from './PatternCard'

interface Pattern {
  id: string
  description: string
  severity: 'INFORMATIONAL' | 'WATCH' | 'ACTION_REQUIRED'
  evidence: { meetingIds: string[]; dates: string[]; tags: string[] }
  detectedAt: string
}

interface PatternListProps {
  patterns: Pattern[]
  meetingCount: number
}

const SEVERITY_ORDER = { ACTION_REQUIRED: 0, WATCH: 1, INFORMATIONAL: 2 }

export default function PatternList({ patterns, meetingCount }: PatternListProps) {
  if (meetingCount < 2) {
    return (
      <div data-testid="pattern-no-history" className="text-sm text-gray-500 italic py-2">
        Not enough meeting data yet. Patterns will appear after 2 or more meetings are recorded.
      </div>
    )
  }

  if (patterns.length === 0) {
    return (
      <div data-testid="pattern-empty-state" className="text-sm text-gray-500 italic py-2">
        No recurring patterns detected yet.
      </div>
    )
  }

  const sorted = [...patterns].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
  )

  return (
    <div data-testid="pattern-list" className="space-y-3">
      {sorted.map((pattern) => (
        <PatternCard key={pattern.id} pattern={pattern} />
      ))}
    </div>
  )
}
