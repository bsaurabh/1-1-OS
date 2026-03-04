import { useState } from 'react'

interface Commitment {
  id: string
  text: string
  owner: 'MANAGER' | 'TEAMMATE'
  status: string
}

interface SuggestedCommitmentsProps {
  commitments: Commitment[]
  onChange: (updated: Commitment[]) => void
}

export default function SuggestedCommitments({
  commitments,
  onChange,
}: SuggestedCommitmentsProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  if (commitments.length === 0) {
    return (
      <p data-testid="no-commitments" className="text-sm text-gray-500 italic">
        All commitments reviewed.
      </p>
    )
  }

  async function handleConfirm(id: string, text?: string) {
    setLoading(id)
    try {
      const res = await fetch(`/api/commitments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', ...(text ? { text } : {}) }),
      })
      if (res.ok) {
        onChange(commitments.filter((c) => c.id !== id))
        setEditingId(null)
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleDismiss(id: string) {
    setLoading(id)
    try {
      const res = await fetch(`/api/commitments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      })
      if (res.ok) {
        onChange(commitments.filter((c) => c.id !== id))
      }
    } finally {
      setLoading(null)
    }
  }

  function startEdit(commitment: Commitment) {
    setEditingId(commitment.id)
    setEditText(commitment.text)
  }

  return (
    <div data-testid="suggested-commitments" className="space-y-3">
      {commitments.map((c) => (
        <div
          key={c.id}
          data-testid={`commitment-${c.id}`}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <span className="mb-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {c.owner === 'MANAGER' ? 'You' : 'Teammate'}
              </span>

              {editingId === c.id ? (
                <textarea
                  data-testid={`commitment-edit-${c.id}`}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
              ) : (
                <p className="mt-0.5 text-sm text-gray-800">{c.text}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {editingId === c.id ? (
                <>
                  <button
                    data-testid={`commitment-save-${c.id}`}
                    onClick={() => handleConfirm(c.id, editText)}
                    disabled={loading === c.id}
                    className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded border px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    data-testid={`commitment-confirm-${c.id}`}
                    onClick={() => handleConfirm(c.id)}
                    disabled={loading === c.id}
                    className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    data-testid={`commitment-edit-btn-${c.id}`}
                    onClick={() => startEdit(c)}
                    disabled={loading === c.id}
                    className="rounded border px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    data-testid={`commitment-dismiss-${c.id}`}
                    onClick={() => handleDismiss(c.id)}
                    disabled={loading === c.id}
                    className="rounded border px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
