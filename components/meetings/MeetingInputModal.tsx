import { useState } from 'react'
import PasteInput from './PasteInput'
import FileUpload from './FileUpload'
import VoiceRecorder from './VoiceRecorder'

interface MeetingInputModalProps {
  teammateId: string
  onSuccess: (meetingId: string) => void
  onClose: () => void
}

type TabId = 'paste' | 'upload' | 'record'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'paste', label: 'Paste Notes' },
  { id: 'upload', label: 'Upload File' },
  { id: 'record', label: 'Record Audio' },
]

export default function MeetingInputModal({ teammateId, onSuccess, onClose }: MeetingInputModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('paste')

  return (
    <div
      data-testid="meeting-input-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Add Meeting Notes</h2>
          <button
            data-testid="modal-close"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div data-testid="meeting-tabs" className="flex border-b">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'paste' && (
            <PasteInput teammateId={teammateId} onSuccess={onSuccess} />
          )}
          {activeTab === 'upload' && (
            <FileUpload teammateId={teammateId} onSuccess={onSuccess} />
          )}
          {activeTab === 'record' && (
            <VoiceRecorder teammateId={teammateId} onSuccess={onSuccess} />
          )}
        </div>
      </div>
    </div>
  )
}
