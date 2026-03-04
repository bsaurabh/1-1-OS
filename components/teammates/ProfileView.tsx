import { useState } from 'react'
import type { TeammateDetail } from '@/lib/teammates'
import type { ProfileFields } from '@/handlers/interviewAIHandler'

const PROFILE_FIELDS: { key: keyof ProfileFields; label: string }[] = [
  { key: 'strengths',             label: 'Strengths' },
  { key: 'growthAreas',           label: 'Growth Areas' },
  { key: 'aspirations',           label: 'Aspirations' },
  { key: 'kpis',                  label: 'KPIs & Success Metrics' },
  { key: 'behavioralTendencies',  label: 'Behavioral Tendencies' },
  { key: 'feedbackStyle',         label: 'Feedback Style' },
  { key: 'motivationDrivers',     label: 'Motivation Drivers' },
]

interface ProfileViewProps {
  teammate:    TeammateDetail
  onDelete:    () => void
  onReinterview: () => void
  onSaved:     (updated: TeammateDetail) => void
}

export default function ProfileView({ teammate, onDelete, onReinterview, onSaved }: ProfileViewProps) {
  const [isEditMode, setEditMode]     = useState(false)
  const [editName, setEditName]       = useState(teammate.name)
  const [editRole, setEditRole]       = useState(teammate.role)
  const [editProfile, setEditProfile] = useState<Partial<ProfileFields>>(
    (teammate.profile ?? {}) as Partial<ProfileFields>
  )
  const [isSaving, setSaving]         = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [showDeleteConfirm, setDeleteConfirm] = useState(false)

  const isIncomplete = teammate.profileCompleteness < 5

  function handleFieldChange(key: keyof ProfileFields, value: string) {
    setEditProfile(prev => ({ ...prev, [key]: value }))
  }

  function handleCancel() {
    setEditName(teammate.name)
    setEditRole(teammate.role)
    setEditProfile((teammate.profile ?? {}) as Partial<ProfileFields>)
    setSaveError(null)
    setEditMode(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    const updates: { name?: string; role?: string; profile?: Partial<ProfileFields> } = {}
    if (editName.trim() !== teammate.name) updates.name = editName.trim()
    if (editRole.trim() !== teammate.role) updates.role = editRole.trim()
    updates.profile = editProfile

    try {
      const res = await fetch(`/api/teammates/${teammate.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(updates),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error ?? 'Something went wrong.')
        return
      }
      onSaved(data as TeammateDetail)
      setEditMode(false)
    } catch {
      setSaveError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          {isEditMode ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="text-2xl font-bold text-gray-900 border-b border-blue-400 focus:outline-none bg-transparent w-full"
                aria-label="Teammate name"
              />
              <input
                type="text"
                value={editRole}
                onChange={e => setEditRole(e.target.value)}
                className="text-sm text-gray-500 border-b border-blue-300 focus:outline-none bg-transparent w-full"
                aria-label="Teammate role"
              />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">{teammate.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{teammate.role}</p>
            </>
          )}
        </div>

        <div className="flex gap-2 ml-4">
          {!isEditMode && (
            <button
              data-testid="edit-profile-button"
              onClick={() => setEditMode(true)}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
            >
              Edit Profile
            </button>
          )}
          {!isEditMode && (
            <button
              data-testid="delete-teammate-button"
              onClick={() => setDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Incomplete warning */}
      {isIncomplete && !isEditMode && (
        <div
          data-testid="profile-incomplete-banner"
          className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800"
        >
          Profile incomplete — fill in more details to improve coaching suggestions.
          {' '}
          <button
            onClick={() => setEditMode(true)}
            className="underline font-medium hover:text-amber-900"
          >
            Edit Profile →
          </button>
        </div>
      )}

      {/* No profile yet */}
      {!teammate.profile && !isEditMode && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
          No profile yet.{' '}
          <button onClick={onReinterview} className="underline font-medium">
            Start interview →
          </button>
          {' '}or edit manually above.
        </div>
      )}

      {/* Profile fields */}
      <div className="space-y-4">
        {PROFILE_FIELDS.map(({ key, label }) => {
          const value = (isEditMode
            ? (editProfile[key] ?? '')
            : ((teammate.profile as ProfileFields | null)?.[key] ?? '')) as string

          return (
            <div
              key={key}
              data-testid={`profile-field-${key}`}
              className="border border-gray-200 rounded-lg p-4"
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {label}
              </p>
              {isEditMode ? (
                <textarea
                  value={value}
                  onChange={e => handleFieldChange(key, e.target.value)}
                  rows={3}
                  placeholder={`Describe ${label.toLowerCase()}...`}
                  className="w-full text-sm text-gray-700 border-0 focus:outline-none resize-none bg-gray-50 rounded p-2"
                  aria-label={label}
                />
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {value || <span className="text-gray-400 italic">Not yet filled in</span>}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Edit mode controls */}
      {isEditMode && (
        <div className="mt-6 flex gap-3">
          <button
            data-testid="profile-save-button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            data-testid="profile-cancel-button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          {saveError && <p className="text-sm text-red-600 self-center">{saveError}</p>}
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(false)} />
          <div className="relative z-10 bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete {teammate.name}?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will remove all meetings, patterns, and commitments. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-delete-button"
                onClick={onDelete}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
