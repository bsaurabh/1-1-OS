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

interface AddCommitmentModalProps {
  teammateId: string
  onSuccess: (commitment: Commitment) => void
  onClose: () => void
}

export default function AddCommitmentModal({ teammateId, onSuccess, onClose }: AddCommitmentModalProps) {
  const [text, setText] = useState('')
  const [owner, setOwner] = useState<'MANAGER' | 'TEAMMATE'>('MANAGER')
  const [dueDate, setDueDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<{ existingId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(forceCreate = false) {
    if (!text.trim()) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/teammates/${teammateId}/commitments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), owner, dueDate: dueDate || null }),
      })

      if (res.status === 201) {
        const data = await res.json()
        onSuccess(data.commitment)
        return
      }

      if (res.status === 409 && !forceCreate) {
        const data = await res.json()
        setDuplicateInfo({ existingId: data.existingId })
        return
      }

      const data = await res.json()
      setError(data.error ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        data-testid="add-commitment-modal"
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
      >
        <h2 className="text-base font-semibold text-gray-900 mb-4">Add Commitment</h2>

        {/* Owner toggle */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Owner</label>
          <div
            data-testid="commitment-owner-toggle"
            className="inline-flex rounded-lg border border-gray-200 overflow-hidden"
          >
            {(['MANAGER', 'TEAMMATE'] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOwner(o)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  owner === o
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {o === 'MANAGER' ? 'Me' : 'Teammate'}
              </button>
            ))}
          </div>
        </div>

        {/* Text */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Commitment *</label>
          <textarea
            data-testid="commitment-text-input"
            value={text}
            onChange={(e) => { setText(e.target.value); setDuplicateInfo(null) }}
            placeholder="Describe the commitment…"
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Due date */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Due date (optional)</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Duplicate warning */}
        {duplicateInfo && (
          <div
            data-testid="commitment-duplicate-warning"
            className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800"
          >
            <p className="mb-2">A similar open commitment already exists.</p>
            <div className="flex gap-2">
              <button
                onClick={() => submit(true)}
                className="rounded px-3 py-1 text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200"
              >
                Add Another
              </button>
              <button
                onClick={onClose}
                className="rounded px-3 py-1 text-xs font-medium bg-white text-amber-700 border border-amber-300 hover:bg-amber-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mb-3 text-sm text-red-600">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            data-testid="commitment-submit-btn"
            onClick={() => submit()}
            disabled={!text.trim() || isSubmitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
