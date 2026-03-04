import TeammateCard from './TeammateCard'
import type { TeammateListItem } from '@/lib/teammates'

interface TeammateListProps {
  teammates: TeammateListItem[]
  onAddClick: () => void
}

export default function TeammateList({ teammates, onAddClick }: TeammateListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Your Team</h2>
        <button
          data-testid="add-teammate-button"
          onClick={onAddClick}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          + Add Teammate
        </button>
      </div>

      {teammates.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-sm">No teammates yet.</p>
          <p className="text-sm mt-1">Add your first direct report to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {teammates.map(t => (
            <TeammateCard key={t.id} teammate={t} />
          ))}
        </div>
      )}
    </div>
  )
}
