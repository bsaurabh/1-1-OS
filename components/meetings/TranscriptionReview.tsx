import { useState } from 'react'

interface TranscriptionReviewProps {
  teammateId: string
  fileId: string
  initialText: string
  onSuccess: (meetingId: string) => void
  onDiscard: () => void
}

export default function TranscriptionReview({
  teammateId,
  fileId,
  initialText,
  onSuccess,
  onDiscard,
}: TranscriptionReviewProps) {
  const [text, setText] = useState(initialText)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!text.trim()) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/meetings/${teammateId}/save-transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      onSuccess(data.meetingId)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDiscard() {
    setLoading(true)
    try {
      await fetch(`/api/transcription/${fileId}`, { method: 'DELETE' })
    } finally {
      setLoading(false)
      onDiscard()
    }
  }

  return (
    <div data-testid="transcription-review" className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Review & edit transcription</p>
        <span className="text-xs text-gray-400">{text.length} chars</span>
      </div>

      <textarea
        data-testid="transcription-textarea"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={loading}
      />

      {error && (
        <p data-testid="transcription-error" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          data-testid="transcription-save"
          onClick={handleSave}
          disabled={!text.trim() || loading}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save & Analyze'}
        </button>
        <button
          data-testid="transcription-discard"
          onClick={handleDiscard}
          disabled={loading}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
