import { detectSchema, normaliseStatus, parseExcelBuffer } from '@/lib/excel/parser'
import * as XLSX from 'xlsx'

// ─── normaliseStatus ──────────────────────────────────────────────────────────

describe('normaliseStatus', () => {
  it('normalises "Done" to "Completed"', () => {
    expect(normaliseStatus('Done')).toBe('Completed')
  })
  it('normalises "done" case-insensitively', () => {
    expect(normaliseStatus('done')).toBe('Completed')
  })
  it('normalises "In Progress" variants', () => {
    expect(normaliseStatus('in progress')).toBe('In Progress')
    expect(normaliseStatus('WIP')).toBe('In Progress')
  })
  it('normalises "Backlog" to "Planned"', () => {
    expect(normaliseStatus('Backlog')).toBe('Planned')
  })
  it('passes through unknown statuses unchanged', () => {
    expect(normaliseStatus('Custom Status')).toBe('Custom Status')
  })
})

// ─── detectSchema ─────────────────────────────────────────────────────────────

describe('detectSchema', () => {
  it('detects standard column names', () => {
    const cols = ['Item Name', 'Status', 'Size', 'Created Date', 'Completed Date', 'Revenue Impact']
    const schema = detectSchema(cols)
    expect(schema.itemName).toBe('Item Name')
    expect(schema.status).toBe('Status')
    expect(schema.size).toBe('Size')
    expect(schema.createdDate).toBe('Created Date')
    expect(schema.completedDate).toBe('Completed Date')
    expect(schema.revenueImpact).toBe('Revenue Impact')
  })

  it('detects fuzzy column names', () => {
    const cols = ['Feature', 'State', 'T-Shirt', 'StartDate', 'DoneDate', 'ARR']
    const schema = detectSchema(cols)
    expect(schema.itemName).toBe('Feature')
    expect(schema.status).toBe('State')
    expect(schema.size).toBe('T-Shirt')
    expect(schema.revenueImpact).toBe('ARR')
  })

  it('returns nulls for missing columns', () => {
    const schema = detectSchema(['Col A', 'Col B'])
    expect(schema.itemName).toBeNull()
    expect(schema.status).toBeNull()
    expect(schema.revenueImpact).toBeNull()
  })
})

// ─── parseExcelBuffer ─────────────────────────────────────────────────────────

function makeBuffer(rows: Record<string, unknown>[]): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

describe('parseExcelBuffer', () => {
  const sampleRows = [
    { 'Item Name': 'Feature A', Status: 'Done', Size: 'M', 'Created Date': '2024-01-01', 'Completed Date': '2024-01-10', 'Revenue Impact': 5000 },
    { 'Item Name': 'Feature B', Status: 'In Progress', Size: 'L', 'Created Date': '2024-02-01', 'Completed Date': null, 'Revenue Impact': null },
    { 'Item Name': 'Feature C', Status: 'Backlog', Size: 'S', 'Created Date': null, 'Completed Date': null, 'Revenue Impact': 1000 },
  ]

  it('parses a valid xlsx buffer', () => {
    const result = parseExcelBuffer(makeBuffer(sampleRows))
    expect(result.rows).toHaveLength(3)
    expect(result.sheetNames).toContain('Sheet1')
    expect(result.needsMapping).toBe(false)
  })

  it('normalises status values', () => {
    const result = parseExcelBuffer(makeBuffer(sampleRows))
    expect(result.rows[0].status).toBe('Completed')
    expect(result.rows[2].status).toBe('Planned')
  })

  it('parses revenue as number', () => {
    const result = parseExcelBuffer(makeBuffer(sampleRows))
    expect(result.rows[0].revenueImpact).toBe(5000)
    expect(result.rows[1].revenueImpact).toBeNull()
  })

  it('sets needsMapping=true when required columns are missing', () => {
    const rows = [{ ColA: 'x', ColB: 'y' }]
    const result = parseExcelBuffer(makeBuffer(rows))
    expect(result.needsMapping).toBe(true)
  })

  it('applies schema override', () => {
    const rows = [{ Task: 'Feature A', State: 'Done' }]
    const result = parseExcelBuffer(makeBuffer(rows), {
      schemaOverride: { itemName: 'Task', status: 'State' }
    })
    expect(result.needsMapping).toBe(false)
    expect(result.rows[0].itemName).toBe('Feature A')
    expect(result.rows[0].status).toBe('Completed')
  })
})
