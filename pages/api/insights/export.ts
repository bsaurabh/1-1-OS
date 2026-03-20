import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'
import * as XLSX from 'xlsx'
import type { ComputedMetrics } from '@/lib/excel/metrics'

export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  managerId: string
) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed')

  const { id } = req.query
  if (typeof id !== 'string') return sendError(res, 400, 'id is required')

  try {
    const { prisma } = await import('@/lib/prisma')
    const analysis = await prisma.excelAnalysis.findUnique({ where: { id } })
    if (!analysis || analysis.managerId !== managerId) return sendError(res, 404, 'Not found')

    const metrics = analysis.metrics as unknown as ComputedMetrics
    const insights = analysis.insights as unknown as string[]
    const recommendations = analysis.recommendations as unknown as string[]

    const wb = XLSX.utils.book_new()

    // Sheet 1: Delivery
    const deliveryRows = [
      ['Status', 'Count'],
      ...Object.entries(metrics.delivery.byStatus),
      [],
      ['Size', 'Count'],
      ...Object.entries(metrics.delivery.bySize),
      [],
      ['Completion Rate (%)', metrics.delivery.completionRate],
      ['Total Items', metrics.delivery.totalItems],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deliveryRows), 'Delivery')

    // Sheet 2: Time & Throughput
    const timeRows: (string | number | null)[][] = [
      ['Avg Turnaround (days)', metrics.time.avgTurnaroundDays ?? 'N/A'],
      ['Items with Delays', metrics.time.itemsWithDelays],
      [],
      ['Size', 'Avg Days'],
      ...Object.entries(metrics.time.avgTurnaroundBySize),
      [],
      ['Month', 'Completed Items'],
      ...Object.entries(metrics.throughput.completedByMonth),
      [],
      ['Velocity Trend', metrics.throughput.velocityTrend],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(timeRows), 'Time & Throughput')

    // Sheet 3: Business Impact
    const bizRows: (string | number | null)[][] = [
      ['Total Revenue', metrics.business.totalRevenue],
      ['Revenue per Completed Item', metrics.business.revenuePerItem ?? 'N/A'],
      [],
      ['Month', 'Revenue'],
      ...metrics.business.revenueByMonth.map((r) => [r.month, r.revenue]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bizRows), 'Business Impact')

    // Sheet 4: Insights & Recommendations
    const insightRows = [
      ['#', 'Insight'],
      ...insights.map((s, i) => [i + 1, s]),
      [],
      ['#', 'Recommendation'],
      ...recommendations.map((s, i) => [i + 1, s]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(insightRows), 'Insights')

    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `insights-${analysis.filename.replace(/\.[^.]+$/, '')}-export.xlsx`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(xlsxBuffer)
  } catch (err) {
    console.error('[insights/export] error:', err)
    return sendError(res, 500, INTERNAL_ERROR)
  }
})
