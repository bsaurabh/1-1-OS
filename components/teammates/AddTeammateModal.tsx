import { useState } from 'react'

interface AddTeammateModalProps {
  isOpen:    boolean
  onClose:   () => void
  onSuccess: (teammateId: string) => void
}

export default function AddTeammateModal({ isOpen, onClose, onSuccess }: AddTeammateModalProps) {
  const [name, setName]           = useState('')
  const [role, setRole]           = useState('')
  const [isSubmitting, setSubmitting] = useState(false)
  const [errors, setErrors]       = useState<{ name?: string; role?: string; general?: string }>({})

  if (!isOpen) return null

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!name.trim()) errs.name = 'Name is required.'
    else if (name.trim().length > 100) errs.name = 'Name must be under 100 characters.'
    if (!role.trim()) errs.role = 'Role is required.'
    else if (role.trim().length > 100) errs.role = 'Role must be under 100 characters.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setErrors({})
    try {
      const res = await fetch('/api/teammates', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), role: role.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors({ general: data.error ?? 'Something went wrong.' })
        return
      }
      onSuccess(data.id)
    } catch {
      setErrors({ general: 'Something went wrong. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setName('')
    setRole('')
    setErrors({})
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Teammate</h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="teammate-name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                id="teammate-name"
                data-testid="teammate-name-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Chirag Mehta"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="teammate-role" className="block text-sm font-medium text-gray-700 mb-1">
                Role / Title
              </label>
              <input
                id="teammate-role"
                data-testid="teammate-role-input"
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="e.g. Senior Product Designer"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.role && (
                <p className="mt-1 text-xs text-red-600">{errors.role}</p>
              )}
            </div>

            {errors.general && (
              <p className="text-xs text-red-600">{errors.general}</p>
            )}
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="start-interview-button"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Start Profile Interview'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
