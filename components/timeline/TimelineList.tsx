import TimelineEntry from './TimelineEntry'

interface TimelineMeetingEntry {
  id: string
  summary: string | null
  tags: string[]
  tone: string | null
  status: string
  createdAt: string
}

interface TimelineListProps {
  meetings: TimelineMeetingEntry[]
  activeTag: string | null
}

export default function TimelineList({ meetings, activeTag }: TimelineListProps) {
  if (meetings.length === 0 && !activeTag) {
    return (
      <p data-testid="timeline-empty" className="text-sm text-gray-500 py-8 text-center">
        No meetings recorded yet. Add your first 1:1 to start tracking growth.
      </p>
    )
  }

  if (meetings.length === 0 && activeTag) {
    return (
      <p data-testid="timeline-filtered-empty" className="text-sm text-gray-500 py-8 text-center">
        No meetings tagged &ldquo;{activeTag}&rdquo;.
      </p>
    )
  }

  return (
    <div data-testid="timeline-list" className="flex flex-col gap-4">
      {meetings.map((meeting) => (
        <TimelineEntry key={meeting.id} meeting={meeting} />
      ))}
    </div>
  )
}
