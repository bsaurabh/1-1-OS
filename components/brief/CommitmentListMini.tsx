interface BriefCommitment {
  text: string
  owner: 'MANAGER' | 'TEAMMATE'
  status: 'OPEN' | 'CARRIED_FORWARD'
  carryCount: number
}

interface CommitmentListMiniProps {
  commitments: BriefCommitment[]
}

export default function CommitmentListMini({ commitments }: CommitmentListMiniProps) {
  if (commitments.length === 0) {
    return (
      <p data-testid="commitment-mini-list" className="text-sm text-gray-500 italic">
        No open commitments.
      </p>
    )
  }

  return (
    <ul data-testid="commitment-mini-list" className="space-y-2">
      {commitments.map((c, i) => (
        <li
          key={i}
          data-testid={`commitment-mini-${i}`}
          className="flex items-start gap-2 text-sm"
        >
          <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded shrink-0">
            {c.owner}
          </span>
          <span className={c.status === 'CARRIED_FORWARD' ? 'text-amber-700' : 'text-gray-800'}>
            {c.text}
          </span>
          {c.status === 'CARRIED_FORWARD' && (
            <span className="text-xs text-amber-600 shrink-0">
              carried{c.carryCount >= 2 ? ` ${c.carryCount}x` : ''}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
