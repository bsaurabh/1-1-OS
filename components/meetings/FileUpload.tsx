import { useRef, useState } from 'react'

interface FileUploadProps {
  teammateId: string
  onSuccess: (meetingId: string) => void
}

const ALLOWED_EXTENSIONS = ['.txt', '.docx', '.pdf']
const MAX_SIZE_BYTES = 10 * 1024 * 1024

export default function FileUpload({ teammateId, onSuccess }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validateFile(file: File): string | null {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type "${ext}". Allowed: .txt, .docx, .pdf`
    }
    if (file.size > MAX_SIZE_BYTES) {
      return 'File exceeds 10MB limit'
    }
    return null
  }

  function handleFileSelected(file: File) {
    setError(null)
    const err = validateFile(file)
    if (err) {
      setError(err)
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelected(file)
  }

  async function handleUpload() {
    if (!selectedFile) return
    setError(null)
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch(`/api/meetings/${teammateId}/upload`, {
        method: 'POST',
        body: formData,
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
    <div data-testid="file-upload" className="space-y-3">
      <div
        data-testid="file-drop-zone"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm text-gray-600">
          {selectedFile ? selectedFile.name : 'Drag & drop or click to select'}
        </p>
        <p className="mt-1 text-xs text-gray-400">.txt, .docx, .pdf — max 10MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".txt,.docx,.pdf"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFileSelected(e.target.files[0]) }}
      />

      {error && (
        <p data-testid="file-upload-error" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        data-testid="file-upload-submit"
        onClick={handleUpload}
        disabled={!selectedFile || loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Uploading…' : 'Upload & Analyze'}
      </button>
    </div>
  )
}
