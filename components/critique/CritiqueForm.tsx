import { useState, useRef } from 'react'

interface CritiqueFormProps {
  onSubmit: (data: CritiqueFormData) => void
  isSubmitting: boolean
}

export interface CritiqueFormData {
  featureName: string
  userType: string
  featureGoal: string
  successMetric: string
  constraints: string
  stage: 'EXPLORATORY' | 'FINAL_POLISH'
  focusAreas: string[]
  imageUrls: string[]
  figmaUrl: string
}

const FOCUS_OPTIONS = [
  'Visual',
  'UX',
  'Interaction',
  'Clarity',
  'Business Logic',
  'Accessibility',
]

type InputMethod = 'figma' | 'upload' | 'url'

export default function CritiqueForm({ onSubmit, isSubmitting }: CritiqueFormProps) {
  const [featureName, setFeatureName] = useState('')
  const [userType, setUserType] = useState('')
  const [featureGoal, setFeatureGoal] = useState('')
  const [successMetric, setSuccessMetric] = useState('')
  const [constraints, setConstraints] = useState('')
  const [stage, setStage] = useState<'EXPLORATORY' | 'FINAL_POLISH'>('EXPLORATORY')
  const [focusAreas, setFocusAreas] = useState<string[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [figmaUrl, setFigmaUrl] = useState('')

  // Input method state
  const [inputMethod, setInputMethod] = useState<InputMethod>('figma')
  const [figmaInput, setFigmaInput] = useState('')
  const [figmaLoading, setFigmaLoading] = useState(false)
  const [figmaError, setFigmaError] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleFocus(area: string) {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }

  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((u) => u !== url))
  }

  // ─── Figma link fetch ──────────────────────────────────────────────────────
  async function handleFigmaFetch() {
    const url = figmaInput.trim()
    if (!url) return

    setFigmaLoading(true)
    setFigmaError(null)

    try {
      const res = await fetch('/api/critique/figma-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figmaUrl: url }),
      })
      const data = await res.json()

      if (!res.ok) {
        setFigmaError(data.error || 'Failed to fetch Figma screenshot')
        return
      }

      if (data.imageUrls?.length > 0) {
        setImageUrls((prev) => [...prev, ...data.imageUrls.filter((u: string) => !prev.includes(u))])
        setFigmaUrl(url)
        setFigmaInput('')
      }
    } catch {
      setFigmaError('Network error. Please try again.')
    } finally {
      setFigmaLoading(false)
    }
  }

  // ─── File upload ───────────────────────────────────────────────────────────
  async function uploadFiles(files: File[]) {
    const imageFiles = files.filter((f) =>
      ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(f.type)
    )
    if (imageFiles.length === 0) {
      setUploadError('Only PNG, JPEG, WebP, and GIF files are supported.')
      return
    }

    setUploadLoading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      imageFiles.forEach((f) => formData.append('images', f))

      const res = await fetch('/api/critique/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error || 'Upload failed')
        return
      }

      if (data.imageUrls?.length > 0) {
        setImageUrls((prev) => [...prev, ...data.imageUrls])
      }
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploadLoading(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) uploadFiles(files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) uploadFiles(files)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  // ─── URL input ─────────────────────────────────────────────────────────────
  function addImageUrl() {
    const url = urlInput.trim()
    if (url && !imageUrls.includes(url)) {
      setImageUrls((prev) => [...prev, url])
      setUrlInput('')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!featureName || !userType || !featureGoal || !successMetric || imageUrls.length === 0) return
    onSubmit({ featureName, userType, featureGoal, successMetric, constraints, stage, focusAreas, imageUrls, figmaUrl })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ─── Design Input Section ─── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Design Input *</label>

        {/* Method tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {([
            { key: 'figma' as InputMethod, label: 'Figma Link' },
            { key: 'upload' as InputMethod, label: 'Upload Images' },
            { key: 'url' as InputMethod, label: 'Image URL' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setInputMethod(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                inputMethod === key
                  ? 'border-indigo-500 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Figma method */}
        {inputMethod === 'figma' && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Paste a Figma link and we&apos;ll fetch a screenshot automatically via the Figma API.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={figmaInput}
                onChange={(e) => setFigmaInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFigmaFetch() } }}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="https://figma.com/design/..."
                disabled={figmaLoading}
              />
              <button
                type="button"
                onClick={handleFigmaFetch}
                disabled={figmaLoading || !figmaInput.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {figmaLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Fetching…
                  </span>
                ) : 'Fetch Screenshot'}
              </button>
            </div>
            {figmaError && (
              <p className="text-xs text-red-600 mt-1.5">{figmaError}</p>
            )}
          </div>
        )}

        {/* Upload method */}
        {inputMethod === 'upload' && (
          <div>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              {uploadLoading ? (
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mb-2" />
                  <p className="text-sm text-gray-500">Uploading…</p>
                </div>
              ) : (
                <>
                  <div className="text-gray-400 text-3xl mb-2">&#128247;</div>
                  <p className="text-sm text-gray-600 mb-1">Drop images here or click to browse</p>
                  <p className="text-xs text-gray-400">PNG, JPEG, WebP, GIF — up to 10MB each</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploadError && (
              <p className="text-xs text-red-600 mt-1.5">{uploadError}</p>
            )}
          </div>
        )}

        {/* URL method */}
        {inputMethod === 'url' && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Add publicly accessible image URLs.</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImageUrl() } }}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="https://..."
              />
              <button
                type="button"
                onClick={addImageUrl}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 border border-gray-300"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Image preview list */}
        {imageUrls.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-gray-500">{imageUrls.length} image{imageUrls.length !== 1 ? 's' : ''} added</p>
            <div className="grid grid-cols-3 gap-2">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative group rounded-md overflow-hidden border border-gray-200 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Screenshot ${i + 1}`}
                    className="w-full h-24 object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.parentElement!.classList.add('flex', 'items-center', 'justify-center', 'h-24')
                      const span = document.createElement('span')
                      span.className = 'text-xs text-gray-400'
                      span.textContent = 'Preview unavailable'
                      target.parentElement!.appendChild(span)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Context Section ─── */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Context</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feature Name *</label>
            <input
              type="text"
              value={featureName}
              onChange={(e) => setFeatureName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g. Options Trading Flow"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target User *</label>
              <input
                type="text"
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. Novice trader, 24-35"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Success Metric *</label>
              <input
                type="text"
                value={successMetric}
                onChange={(e) => setSuccessMetric(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. Completion rate > 60%"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feature Goal *</label>
            <textarea
              value={featureGoal}
              onChange={(e) => setFeatureGoal(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="What should this feature achieve for the user?"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Constraints (optional)</label>
            <input
              type="text"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g. DS locked, 2 week timeline, legacy API"
            />
          </div>
        </div>
      </div>

      {/* ─── Options Section ─── */}
      <div className="border-t border-gray-200 pt-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Design Stage</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStage('EXPLORATORY')}
                className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                  stage === 'EXPLORATORY'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Exploratory
                <span className="block text-[10px] font-normal text-gray-400 mt-0.5">Structural + product focus</span>
              </button>
              <button
                type="button"
                onClick={() => setStage('FINAL_POLISH')}
                className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                  stage === 'FINAL_POLISH'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Final Polish
                <span className="block text-[10px] font-normal text-gray-400 mt-0.5">Craft + accessibility focus</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Focus Areas (optional — defaults to all)</label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleFocus(area)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    focusAreas.includes(area)
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || !featureName || !userType || !featureGoal || !successMetric || imageUrls.length === 0}
        className="w-full py-2.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Creating…' : 'Start Critique'}
      </button>
    </form>
  )
}
