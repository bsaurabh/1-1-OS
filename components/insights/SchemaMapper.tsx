import type { SchemaMapping } from '@/lib/excel/parser'

interface SchemaMapperProps {
  columns: string[]
  detectedSchema: SchemaMapping
  sheetNames: string[]
  selectedSheet: string
  onSubmit: (mapping: Partial<SchemaMapping>, sheetName: string) => void
}

const REQUIRED_FIELDS: (keyof SchemaMapping)[] = ['itemName', 'status']
const OPTIONAL_FIELDS: (keyof SchemaMapping)[] = ['size', 'createdDate', 'completedDate', 'revenueImpact']

const FIELD_LABELS: Record<keyof SchemaMapping, string> = {
  itemName: 'Item Name *',
  status: 'Status *',
  size: 'Size (S/M/L)',
  createdDate: 'Created Date',
  completedDate: 'Completed Date',
  revenueImpact: 'Revenue Impact',
}

export default function SchemaMapper({ columns, detectedSchema, sheetNames, selectedSheet, onSubmit }: SchemaMapperProps) {
  const allCols = ['(none)', ...columns]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const mapping: Partial<SchemaMapping> = {}
    const allFields: (keyof SchemaMapping)[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]
    for (const field of allFields) {
      const val = fd.get(field) as string
      mapping[field] = val === '(none)' ? null : val
    }
    const sheet = fd.get('sheetName') as string
    onSubmit(mapping, sheet)
  }

  function defaultVal(field: keyof SchemaMapping) {
    return detectedSchema[field] ?? '(none)'
  }

  return (
    <div data-testid="schema-mapper" className="bg-amber-50 border border-amber-200 rounded-xl p-6">
      <h3 className="font-semibold text-amber-900 mb-1">Column Mapping Required</h3>
      <p className="text-sm text-amber-700 mb-4">We couldn&apos;t auto-detect all required columns. Please map them manually.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {sheetNames.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sheet</label>
            <select name="sheetName" defaultValue={selectedSheet} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {sheetNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS[field]}</label>
            <select
              name={field}
              defaultValue={defaultVal(field) ?? '(none)'}
              data-testid={`schema-select-${field}`}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {allCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ))}
        <button
          type="submit"
          data-testid="schema-submit"
          className="w-full bg-indigo-600 text-white py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          Analyse with this mapping
        </button>
      </form>
    </div>
  )
}
