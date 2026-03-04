import { useState } from 'react'

interface PasteInputProps {
  teammateId: string
  onSuccess: (meetingId: string) => void
}

const MIN_LENGTH = 50

export default function PasteInput({ teammateId, onSuccess }: PasteInputProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const charCount = text.length
  const isShort = charCount < MIN_LENGTH

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/meetings/${teammateId}/paste`, {
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

  return (
    <div data-testid="paste-input" className="space-y-3">
      <div className="relative">
        <textarea
          data-testid="paste-textarea"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          rows={8}
          placeholder="Paste your meeting notes here (minimum 50 characters)…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
        />
        <span
          data-testid="paste-char-count"
          className={`absolute bottom-2 right-3 text-xs ${isShort ? 'text-red-500' : 'text-gray-400'}`}
        >
          {charCount} / {MIN_LENGTH} min
        </span>
      </div>

      {error && (
        <p data-testid="paste-error" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        data-testid="paste-submit"
        onClick={handleSubmit}
        disabled={isShort || loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Submitting…' : 'Analyze Notes'}
      </button>
    </div>
  )
}
