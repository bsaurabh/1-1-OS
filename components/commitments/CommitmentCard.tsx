import { useState } from 'react'

interface Commitment {
  id: string
  text: string
  owner: 'MANAGER' | 'TEAMMATE'
  status: 'OPEN' | 'CARRIED_FORWARD' | 'DONE' | 'DROPPED'
  carryCount: number
  dueDate: string | null
  createdAt: string
}

interface CommitmentCardProps {
  commitment: Commitment
  onAction: (id: string, action: string) => void
  showActions?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  CARRIED_FORWARD: 'Carried Forward',
  DONE: 'Done',
  DROPPED: 'Dropped',
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  CARRIED_FORWARD: 'bg-amber-100 text-amber-800',
  DONE: 'bg-green-100 text-green-800',
  DROPPED: 'bg-gray-100 text-gray-500',
}

export default function CommitmentCard({ commitment, onAction, showActions = true }: CommitmentCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleAction(action: string) {
    setIsLoading(true)
    try {
      await onAction(commitment.id, action)
    } finally {
      setIsLoading(false)
    }
  }

  const isCarriedHighFreq =
    commitment.status === 'CARRIED_FORWARD' && commitment.carryCount >= 2

  return (
    <div
      data-testid={`commitment-card-${commitment.id}`}
      className={`rounded-lg border bg-white p-4 text-sm ${
        isCarriedHighFreq ? 'border-l-4 border-l-amber-400 border-amber-200' : 'border-gray-200'
      } ${commitment.status === 'DROPPED' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Owner + Status */}
          <div className="flex items-center gap-2 mb-1">
            <span
              data-testid={`commitment-owner-${commitment.id}`}
              className="text-xs font-medium text-gray-500"
            >
              {commitment.owner === 'MANAGER' ? 'You' : 'Teammate'}
            </span>
            <span
              data-testid={`commitment-status-${commitment.id}`}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[commitment.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {STATUS_LABELS[commitment.status] ?? commitment.status}
            </span>
            {commitment.carryCount >= 2 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Carried {commitment.carryCount}×
              </span>
            )}
          </div>

          {/* Text */}
          <p
            data-testid={`commitment-text-${commitment.id}`}
            className={`text-gray-800 ${commitment.status === 'DROPPED' ? 'line-through text-gray-400' : ''} ${commitment.status === 'DONE' ? 'text-gray-400' : ''}`}
          >
            {commitment.text}
          </p>

          {/* Due date */}
          {commitment.dueDate && (
            <p className="mt-1 text-xs text-gray-500">
              Due {new Date(commitment.dueDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {showActions && (commitment.status === 'OPEN' || commitment.status === 'CARRIED_FORWARD') && (
        <div className="mt-3 flex gap-2">
          <button
            data-testid={`commitment-done-${commitment.id}`}
            onClick={() => handleAction('done')}
            disabled={isLoading}
            className="rounded px-3 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50"
          >
            Mark Done
          </button>
          <button
            data-testid={`commitment-carry-${commitment.id}`}
            onClick={() => handleAction('carried_forward')}
            disabled={isLoading}
            className="rounded px-3 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
          >
            Carry Forward
          </button>
          <button
            data-testid={`commitment-drop-${commitment.id}`}
            onClick={() => handleAction('dropped')}
            disabled={isLoading}
            className="rounded px-3 py-1 text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
          >
            Drop
          </button>
        </div>
      )}
    </div>
  )
}
