import { computeDelivery, computeTime, computeBusiness, computeThroughput, computeMetrics } from '@/lib/excel/metrics'
import type { ParsedRow } from '@/lib/excel/parser'

function makeRow(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    itemName: 'Feature',
    status: 'Completed',
    size: 'M',
    createdDate: new Date('2024-01-01'),
    completedDate: new Date('2024-01-10'),
    revenueImpact: null,
    ...overrides,
  }
}

// ─── Delivery ─────────────────────────────────────────────────────────────────

describe('computeDelivery', () => {
  it('counts items by status', () => {
    const rows = [
      makeRow({ status: 'Completed' }),
      makeRow({ status: 'Completed' }),
      makeRow({ status: 'In Progress' }),
      makeRow({ status: 'Planned' }),
    ]
    const result = computeDelivery(rows)
    expect(result.byStatus.Completed).toBe(2)
    expect(result.byStatus['In Progress']).toBe(1)
    expect(result.byStatus.Planned).toBe(1)
    expect(result.totalItems).toBe(4)
  })

  it('calculates completion rate', () => {
    const rows = [
      makeRow({ status: 'Completed' }),
      makeRow({ status: 'In Progress' }),
      makeRow({ status: 'In Progress' }),
      makeRow({ status: 'In Progress' }),
    ]
    expect(computeDelivery(rows).completionRate).toBe(25)
  })

  it('returns 0 completion rate for empty rows', () => {
    expect(computeDelivery([]).completionRate).toBe(0)
  })

  it('counts items by size', () => {
    const rows = [makeRow({ size: 'S' }), makeRow({ size: 'M' }), makeRow({ size: 'M' })]
    const result = computeDelivery(rows)
    expect(result.bySize.S).toBe(1)
    expect(result.bySize.M).toBe(2)
  })
})

// ─── Time ─────────────────────────────────────────────────────────────────────

describe('computeTime', () => {
  it('computes average turnaround days', () => {
    const rows = [
      makeRow({ createdDate: new Date('2024-01-01'), completedDate: new Date('2024-01-11') }), // 10 days
      makeRow({ createdDate: new Date('2024-01-01'), completedDate: new Date('2024-01-21') }), // 20 days
    ]
    const result = computeTime(rows)
    expect(result.avgTurnaroundDays).toBe(15)
  })

  it('returns null turnaround when no dates present', () => {
    const rows = [makeRow({ createdDate: null, completedDate: null })]
    expect(computeTime(rows).avgTurnaroundDays).toBeNull()
  })

  it('computes avg turnaround by size', () => {
    const rows = [
      makeRow({ size: 'S', createdDate: new Date('2024-01-01'), completedDate: new Date('2024-01-06') }), // 5 days
      makeRow({ size: 'L', createdDate: new Date('2024-01-01'), completedDate: new Date('2024-01-21') }), // 20 days
    ]
    const result = computeTime(rows)
    expect(result.avgTurnaroundBySize.S).toBe(5)
    expect(result.avgTurnaroundBySize.L).toBe(20)
  })
})

// ─── Business ─────────────────────────────────────────────────────────────────

describe('computeBusiness', () => {
  it('sums revenue for completed items', () => {
    const rows = [
      makeRow({ status: 'Completed', revenueImpact: 10000, completedDate: new Date('2024-01-15') }),
      makeRow({ status: 'Completed', revenueImpact: 5000, completedDate: new Date('2024-01-20') }),
      makeRow({ status: 'In Progress', revenueImpact: 9999 }), // not counted
    ]
    const result = computeBusiness(rows)
    expect(result.totalRevenue).toBe(15000)
  })

  it('computes revenue per item', () => {
    const rows = [
      makeRow({ status: 'Completed', revenueImpact: 10000 }),
      makeRow({ status: 'Completed', revenueImpact: 0 }),
    ]
    const result = computeBusiness(rows)
    expect(result.revenuePerItem).toBe(5000)
  })

  it('returns empty revenueByMonth when no revenue', () => {
    const rows = [makeRow({ revenueImpact: null })]
    expect(computeBusiness(rows).revenueByMonth).toHaveLength(0)
  })
})

// ─── Throughput ───────────────────────────────────────────────────────────────

describe('computeThroughput', () => {
  it('counts completed items by month', () => {
    const rows = [
      makeRow({ completedDate: new Date('2024-01-15') }),
      makeRow({ completedDate: new Date('2024-01-20') }),
      makeRow({ completedDate: new Date('2024-02-05') }),
    ]
    const result = computeThroughput(rows)
    expect(result.completedByMonth['2024-01']).toBe(2)
    expect(result.completedByMonth['2024-02']).toBe(1)
  })

  it('returns insufficient_data with less than 3 months', () => {
    const rows = [
      makeRow({ completedDate: new Date('2024-01-01') }),
      makeRow({ completedDate: new Date('2024-02-01') }),
    ]
    expect(computeThroughput(rows).velocityTrend).toBe('insufficient_data')
  })
})

// ─── computeMetrics integration ───────────────────────────────────────────────

describe('computeMetrics', () => {
  it('returns all metric groups', () => {
    const rows = [makeRow()]
    const result = computeMetrics(rows)
    expect(result).toHaveProperty('delivery')
    expect(result).toHaveProperty('time')
    expect(result).toHaveProperty('business')
    expect(result).toHaveProperty('throughput')
    expect(result).toHaveProperty('quality')
  })
})
