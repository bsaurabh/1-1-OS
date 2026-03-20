/**
 * Integration tests for /api/insights/* endpoints.
 * Mocks: withAuth (injects managerId), prisma, excelInsightsHandler, lib/excel modules.
 */

import { createMocks } from 'node-mocks-http'

// ─── Shared mocks ─────────────────────────────────────────────────────────────

const MANAGER_ID = 'mgr-test-123'

jest.mock('@/lib/withAuth', () => ({
  withAuth: (handler: Function) => (req: unknown, res: unknown) => handler(req, res, MANAGER_ID),
}))

const mockPrisma = {
  excelAnalysis: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
jest.mock('@/handlers/excelInsightsHandler', () => ({
  generateInsights: jest.fn().mockResolvedValue({
    insights: ['Insight 1'],
    recommendations: ['Add Start Date'],
  }),
}))
jest.mock('@/lib/excel/parser', () => ({
  parseExcelBuffer: jest.fn().mockReturnValue({
    rows: [{ itemName: 'Feature A', status: 'Completed', size: 'M', createdDate: new Date('2024-01-01'), completedDate: new Date('2024-01-10'), revenueImpact: null }],
    detectedSchema: { itemName: 'Item Name', status: 'Status', size: 'Size', createdDate: null, completedDate: null, revenueImpact: null },
    unmappedColumns: [],
    sheetNames: ['Sheet1'],
    selectedSheet: 'Sheet1',
    needsMapping: false,
  }),
}))
jest.mock('@/lib/excel/metrics', () => ({
  computeMetrics: jest.fn().mockReturnValue({
    delivery: { totalItems: 1, byStatus: { Completed: 1 }, bySize: { M: 1 }, completionRate: 100 },
    time: { avgTurnaroundDays: 9, avgTurnaroundBySize: {}, itemsWithDelays: 0 },
    business: { totalRevenue: 0, revenueByMonth: [], revenuePerItem: null },
    throughput: { completedByMonth: { '2024-01': 1 }, velocityTrend: 'insufficient_data' },
    quality: { available: false },
  }),
}))

// ─── GET /api/insights (list) ─────────────────────────────────────────────────

describe('GET /api/insights', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns list of analyses for manager', async () => {
    const handler = require('@/pages/api/insights/index').default
    mockPrisma.excelAnalysis.findMany.mockResolvedValue([
      { id: 'a1', filename: 'data.xlsx', sheetName: 'Sheet1', rowCount: 10, analysedAt: new Date(), status: 'COMPLETE' },
    ])
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    const body = JSON.parse(res._getData())
    expect(body.analyses).toHaveLength(1)
  })

  it('returns 405 for non-GET', async () => {
    const handler = require('@/pages/api/insights/index').default
    const { req, res } = createMocks({ method: 'POST' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(405)
  })
})

// ─── GET /api/insights/[id] ───────────────────────────────────────────────────

describe('GET /api/insights/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns analysis when owner matches', async () => {
    const handler = require('@/pages/api/insights/[id]').default
    mockPrisma.excelAnalysis.findUnique.mockResolvedValue({
      id: 'a1', managerId: MANAGER_ID, filename: 'data.xlsx', sheetName: null,
      rowCount: 5, analysedAt: new Date(), metrics: {}, insights: [], recommendations: [], status: 'COMPLETE',
    })
    const { req, res } = createMocks({ method: 'GET', query: { id: 'a1' } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
  })

  it('returns 404 when managerId does not match', async () => {
    const handler = require('@/pages/api/insights/[id]').default
    mockPrisma.excelAnalysis.findUnique.mockResolvedValue({ id: 'a1', managerId: 'other-mgr' })
    const { req, res } = createMocks({ method: 'GET', query: { id: 'a1' } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(404)
  })

  it('returns 404 for unknown id', async () => {
    const handler = require('@/pages/api/insights/[id]').default
    mockPrisma.excelAnalysis.findUnique.mockResolvedValue(null)
    const { req, res } = createMocks({ method: 'GET', query: { id: 'unknown' } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(404)
  })
})

// ─── DELETE /api/insights/[id] ────────────────────────────────────────────────

describe('DELETE /api/insights/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('deletes analysis and returns 204', async () => {
    const handler = require('@/pages/api/insights/[id]').default
    mockPrisma.excelAnalysis.findUnique.mockResolvedValue({ id: 'a1', managerId: MANAGER_ID })
    mockPrisma.excelAnalysis.delete.mockResolvedValue({})
    const { req, res } = createMocks({ method: 'DELETE', query: { id: 'a1' } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(204)
    expect(mockPrisma.excelAnalysis.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
  })

  it('returns 404 when not owner', async () => {
    const handler = require('@/pages/api/insights/[id]').default
    mockPrisma.excelAnalysis.findUnique.mockResolvedValue({ id: 'a1', managerId: 'other' })
    const { req, res } = createMocks({ method: 'DELETE', query: { id: 'a1' } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(404)
  })
})
