import { useState } from 'react'

interface SheetSelectorProps {
  sheetNames: string[]
  onSelect: (sheetName: string) => void
}

export default function SheetSelector({ sheetNames, onSelect }: SheetSelectorProps) {
  const [selected, setSelected] = useState(sheetNames[0])

  return (
    <div className="border border-gray-200 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Select a sheet to analyse</h2>
        <p className="text-xs text-gray-500 mt-1">
          This workbook has {sheetNames.length} sheets. Choose the one containing your work item data.
        </p>
      </div>

      <div className="space-y-2">
        {sheetNames.map((name) => (
          <label
            key={name}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
              selected === name
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="sheet"
              value={name}
              checked={selected === name}
              onChange={() => setSelected(name)}
              className="accent-indigo-600"
            />
            <span className="text-sm text-gray-800">{name}</span>
          </label>
        ))}
      </div>

      <button
        onClick={() => onSelect(selected)}
        className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        Analyse this sheet
      </button>
    </div>
  )
}
