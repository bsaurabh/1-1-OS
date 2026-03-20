import type { ParsedRow } from './parser'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeliveryMetrics {
  totalItems: number
  byStatus: Record<string, number>
  bySize: Record<string, number>
  completionRate: number
}

export interface TimeMetrics {
  avgTurnaroundDays: number | null
  avgTurnaroundBySize: Record<string, number>
  itemsWithDelays: number
}

export interface MonthlyRevenue {
  month: string
  revenue: number
}

export interface BusinessMetrics {
  totalRevenue: number
  revenueByMonth: MonthlyRevenue[]
  revenuePerItem: number | null
}

export interface ThroughputMetrics {
  completedByMonth: Record<string, number>
  velocityTrend: 'improving' | 'stable' | 'declining' | 'insufficient_data'
}

export interface QualityMetrics {
  available: false
}

export interface ComputedMetrics {
  delivery: DeliveryMetrics
  time: TimeMetrics
  business: BusinessMetrics
  throughput: ThroughputMetrics
  quality: QualityMetrics
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 10) / 10
}

// ─── Delivery metrics ─────────────────────────────────────────────────────────

export function computeDelivery(rows: ParsedRow[]): DeliveryMetrics {
  const byStatus: Record<string, number> = {}
  const bySize: Record<string, number> = {}

  for (const row of rows) {
    if (row.status) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
    if (row.size) bySize[row.size] = (bySize[row.size] ?? 0) + 1
  }

  const completed = byStatus['Completed'] ?? 0
  // Use only rows that have a status value — empty cells shouldn't dilute the rate
  const rowsWithStatus = rows.filter((r) => r.status != null).length
  const completionRate = rowsWithStatus > 0 ? Math.round((completed / rowsWithStatus) * 100) : 0

  return { totalItems: rows.length, byStatus, bySize, completionRate }
}

// ─── Time metrics ─────────────────────────────────────────────────────────────

export function computeTime(rows: ParsedRow[]): TimeMetrics {
  const turnarounds: number[] = []
  const turnaroundBySize: Record<string, number[]> = {}
  let itemsWithDelays = 0

  for (const row of rows) {
    if (row.createdDate && row.completedDate) {
      const days = daysBetween(row.createdDate, row.completedDate)
      turnarounds.push(days)
      if (row.size) {
        if (!turnaroundBySize[row.size]) turnaroundBySize[row.size] = []
        turnaroundBySize[row.size].push(days)
      }
    }
  }

  const avgTurnaroundDays = average(turnarounds)
  if (avgTurnaroundDays !== null) {
    itemsWithDelays = turnarounds.filter((d) => d > avgTurnaroundDays * 1.5).length
  }

  const avgTurnaroundBySize: Record<string, number> = {}
  for (const [size, days] of Object.entries(turnaroundBySize)) {
    const avg = average(days)
    if (avg !== null) avgTurnaroundBySize[size] = avg
  }

  return { avgTurnaroundDays, avgTurnaroundBySize, itemsWithDelays }
}

// ─── Business metrics ─────────────────────────────────────────────────────────

export function computeBusiness(rows: ParsedRow[]): BusinessMetrics {
  let totalRevenue = 0
  const revenueByMonthMap: Record<string, number> = {}

  const completedWithRevenue = rows.filter(
    (r) => r.status === 'Completed' && r.revenueImpact != null && r.revenueImpact > 0
  )

  for (const row of completedWithRevenue) {
    totalRevenue += row.revenueImpact!
    const dateKey = row.completedDate
      ? toMonthKey(row.completedDate)
      : row.createdDate
      ? toMonthKey(row.createdDate)
      : 'Unknown'
    revenueByMonthMap[dateKey] = (revenueByMonthMap[dateKey] ?? 0) + row.revenueImpact!
  }

  const revenueByMonth: MonthlyRevenue[] = Object.entries(revenueByMonthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue: Math.round(revenue) }))

  const completedCount = rows.filter((r) => r.status === 'Completed').length
  const revenuePerItem = completedCount > 0 ? Math.round(totalRevenue / completedCount) : null

  return { totalRevenue: Math.round(totalRevenue), revenueByMonth, revenuePerItem }
}

// ─── Throughput metrics ───────────────────────────────────────────────────────

export function computeThroughput(rows: ParsedRow[]): ThroughputMetrics {
  const completedByMonth: Record<string, number> = {}

  for (const row of rows) {
    if (row.status === 'Completed') {
      const dateKey = row.completedDate
        ? toMonthKey(row.completedDate)
        : row.createdDate
        ? toMonthKey(row.createdDate)
        : null
      if (dateKey) completedByMonth[dateKey] = (completedByMonth[dateKey] ?? 0) + 1
    }
  }

  const monthCounts = Object.entries(completedByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, count]) => count)

  let velocityTrend: ThroughputMetrics['velocityTrend'] = 'insufficient_data'
  if (monthCounts.length >= 3) {
    const recent = monthCounts.slice(-2)
    const older = monthCounts.slice(0, -2)
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
    const delta = recentAvg - olderAvg
    if (delta > olderAvg * 0.1) velocityTrend = 'improving'
    else if (delta < -olderAvg * 0.1) velocityTrend = 'declining'
    else velocityTrend = 'stable'
  }

  return { completedByMonth, velocityTrend }
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export function computeMetrics(rows: ParsedRow[]): ComputedMetrics {
  return {
    delivery: computeDelivery(rows),
    time: computeTime(rows),
    business: computeBusiness(rows),
    throughput: computeThroughput(rows),
    quality: { available: false },
  }
}
