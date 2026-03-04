interface TagFilterProps {
  availableTags: string[]
  activeTag: string | null
  onTagSelect: (tag: string | null) => void
}

export default function TagFilter({ availableTags, activeTag, onTagSelect }: TagFilterProps) {
  if (availableTags.length === 0) return null

  return (
    <div data-testid="tag-filter" className="flex flex-wrap gap-2 mb-4">
      {/* "All" chip */}
      <button
        data-testid="tag-filter-all"
        onClick={() => onTagSelect(null)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          activeTag === null
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        All
      </button>

      {availableTags.map((tag) => (
        <button
          key={tag}
          data-testid={`tag-filter-chip-${tag}`}
          onClick={() => onTagSelect(activeTag === tag ? null : tag)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeTag === tag
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
