import { useRouter } from 'next/router'
import type { TeammateListItem } from '@/lib/teammates'

interface TeammateCardProps {
  teammate: TeammateListItem
}

export default function TeammateCard({ teammate }: TeammateCardProps) {
  const router = useRouter()
  const initials = teammate.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isComplete = teammate.profileCompleteness >= 5

  return (
    <button
      data-testid={`teammate-card-${teammate.id}`}
      onClick={() => router.push(`/teammates/${teammate.id}`)}
      className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-sm font-semibold text-blue-700">{initials}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{teammate.name}</p>
          <p className="text-xs text-gray-500 truncate">{teammate.role}</p>
        </div>

        {/* Completeness badge */}
        <div className="flex-shrink-0">
          {isComplete ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              Profile complete
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              Incomplete
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
