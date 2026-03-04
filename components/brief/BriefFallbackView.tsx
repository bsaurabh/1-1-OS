interface BriefCommitment {
  text: string
  owner: 'MANAGER' | 'TEAMMATE'
  status: 'OPEN' | 'CARRIED_FORWARD'
  carryCount: number
}

interface BriefFallback {
  commitments: BriefCommitment[]
  lastMeetingSummary: string | null
  lastMeetingDate: string | null
}

interface BriefFallbackViewProps {
  fallback: BriefFallback
  onRetry: () => void
}

export default function BriefFallbackView({ fallback, onRetry }: BriefFallbackViewProps) {
  return (
    <div data-testid="brief-fallback-view" className="space-y-6">
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm text-amber-800">
          Brief generation failed. Here is a summary of open commitments and last meeting notes to
          help you prepare.
        </p>
      </div>

      {fallback.commitments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Open Commitments</h3>
          <ul className="space-y-2">
            {fallback.commitments.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded shrink-0">
                  {c.owner}
                </span>
                <span className="text-gray-800">{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fallback.lastMeetingSummary && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Last Meeting
            {fallback.lastMeetingDate && (
              <span className="font-normal text-gray-400 ml-2">
                {new Date(fallback.lastMeetingDate).toLocaleDateString()}
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-700">{fallback.lastMeetingSummary}</p>
        </div>
      )}

      <button
        data-testid="brief-fallback-retry"
        onClick={onRetry}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Try Again
      </button>
    </div>
  )
}
