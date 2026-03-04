import CommitmentCard from './CommitmentCard'

interface Commitment {
  id: string
  text: string
  owner: 'MANAGER' | 'TEAMMATE'
  status: 'OPEN' | 'CARRIED_FORWARD' | 'DONE' | 'DROPPED'
  carryCount: number
  dueDate: string | null
  createdAt: string
}

interface CommitmentListProps {
  commitments: Commitment[]
  onAction: (id: string, action: string) => void
  showActions?: boolean
  emptyMessage?: string
}

export default function CommitmentList({
  commitments,
  onAction,
  showActions = true,
  emptyMessage = 'No open commitments.',
}: CommitmentListProps) {
  if (commitments.length === 0) {
    return (
      <p
        data-testid="commitment-list-empty"
        className="text-sm text-gray-500 py-4"
      >
        {emptyMessage}
      </p>
    )
  }

  return (
    <div data-testid="commitment-list" className="flex flex-col gap-3">
      {commitments.map((c) => (
        <CommitmentCard
          key={c.id}
          commitment={c}
          onAction={onAction}
          showActions={showActions}
        />
      ))}
    </div>
  )
}
