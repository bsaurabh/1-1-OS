interface TimelineMeetingEntry {
  id: string
  summary: string | null
  tags: string[]
  tone: string | null
  status: string
  createdAt: string
}

interface TimelineEntryProps {
  meeting: TimelineMeetingEntry
}

const STATUS_SUMMARY: Record<string, string> = {
  PENDING: 'Analysis in progress…',
  PROCESSING: 'Analysis in progress…',
  ANALYSIS_FAILED: 'Analysis failed.',
}

export default function TimelineEntry({ meeting }: TimelineEntryProps) {
  const displaySummary = meeting.summary ?? STATUS_SUMMARY[meeting.status] ?? 'Analysis in progress…'
  const date = new Date(meeting.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      data-testid={`timeline-entry-${meeting.id}`}
      className="rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <span
          data-testid={`timeline-entry-date-${meeting.id}`}
          className="text-xs font-medium text-gray-500"
        >
          {date}
        </span>
        {meeting.tone && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
            {meeting.tone}
          </span>
        )}
      </div>

      <p
        data-testid={`timeline-entry-summary-${meeting.id}`}
        className={`text-sm ${meeting.summary ? 'text-gray-800' : 'text-gray-400 italic'}`}
      >
        {displaySummary}
      </p>

      {meeting.tags.length > 0 && (
        <div
          data-testid={`timeline-entry-tags-${meeting.id}`}
          className="mt-2 flex flex-wrap gap-1"
        >
          {meeting.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
