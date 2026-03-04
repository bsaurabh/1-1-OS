import { useState } from 'react'

interface PatternCardProps {
  pattern: {
    id: string
    description: string
    severity: 'INFORMATIONAL' | 'WATCH' | 'ACTION_REQUIRED'
    evidence: { meetingIds: string[]; dates: string[]; tags: string[] }
    detectedAt: string
  }
}

const SEVERITY_CONFIG = {
  INFORMATIONAL: { label: 'Informational', bg: 'bg-blue-100', text: 'text-blue-800' },
  WATCH: { label: 'Watch', bg: 'bg-amber-100', text: 'text-amber-800' },
  ACTION_REQUIRED: { label: 'Action Required', bg: 'bg-red-100', text: 'text-red-800' },
}

export default function PatternCard({ pattern }: PatternCardProps) {
  const [expanded, setExpanded] = useState(false)
  const config = SEVERITY_CONFIG[pattern.severity]

  return (
    <div
      data-testid={`pattern-card-${pattern.id}`}
      className="border border-gray-200 rounded-lg p-3 bg-white"
    >
      <div className="flex items-start gap-2">
        <span
          data-testid={`pattern-severity-${pattern.id}`}
          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text} shrink-0`}
        >
          {config.label}
        </span>
        <p
          data-testid={`pattern-description-${pattern.id}`}
          className="text-sm text-gray-800 flex-1"
        >
          {pattern.description}
        </p>
        <button
          data-testid={`pattern-expand-${pattern.id}`}
          onClick={() => setExpanded((e) => !e)}
          className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
          aria-label={expanded ? 'Collapse evidence' : 'Show evidence'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 pl-2 border-l-2 border-gray-100 text-xs text-gray-500 space-y-1">
          {pattern.evidence.dates.length > 0 && (
            <p>Seen on: {pattern.evidence.dates.slice(0, 5).join(', ')}</p>
          )}
          {pattern.evidence.tags.length > 0 && (
            <p>Tags: {pattern.evidence.tags.join(', ')}</p>
          )}
          <p>
            First detected: {new Date(pattern.detectedAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  )
}
