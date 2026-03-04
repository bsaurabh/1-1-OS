interface MeetingAnalysisResultsProps {
  summary: string
  tone: string
  tags: string[]
  themes: string[]
  source: 'PASTE' | 'UPLOAD' | 'VOICE'
}

const SOURCE_LABELS: Record<string, string> = {
  PASTE: 'Pasted notes',
  UPLOAD: 'Uploaded file',
  VOICE: 'Voice recording',
}

const TONE_COLORS: Record<string, string> = {
  productive: 'bg-green-100 text-green-800',
  collaborative: 'bg-blue-100 text-blue-800',
  tense: 'bg-red-100 text-red-800',
  exploratory: 'bg-purple-100 text-purple-800',
  challenging: 'bg-orange-100 text-orange-800',
}

function getToneBadgeClass(tone: string): string {
  return TONE_COLORS[tone.toLowerCase()] ?? 'bg-gray-100 text-gray-800'
}

export default function MeetingAnalysisResults({
  summary,
  tone,
  tags,
  themes,
  source,
}: MeetingAnalysisResultsProps) {
  return (
    <div data-testid="meeting-analysis-results" className="space-y-5">
      {/* Source indicator */}
      <p className="text-xs text-gray-500" data-testid="meeting-source">
        Source: {SOURCE_LABELS[source] ?? source}
      </p>

      {/* Summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Summary</h3>
        <p data-testid="meeting-summary" className="text-sm text-gray-800 leading-relaxed">
          {summary}
        </p>
      </div>

      {/* Tone */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">Tone:</span>
        <span
          data-testid="meeting-tone"
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getToneBadgeClass(tone)}`}
        >
          {tone}
        </span>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Tags</h3>
          <div data-testid="meeting-tags" className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Themes */}
      {themes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Themes</h3>
          <ul data-testid="meeting-themes" className="space-y-1">
            {themes.map((theme, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                {theme}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
