import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './summary'

jest.mock('@/lib/withAuth', () => ({
  withAuth: (fn: Function) => fn,
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    teammate: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/timeline', () => ({
  generateGrowthSummary: jest.fn(),
  EmptyHistoryError: class EmptyHistoryError extends Error {
    constructor() { super('No history'); this.name = 'EmptyHistoryError' }
  },
}))

import { prisma } from '@/lib/prisma'
import { generateGrowthSummary, EmptyHistoryError } from '@/lib/timeline'

const mockTeammate = prisma.teammate as jest.Mocked<typeof prisma.teammate>
const mockGenerate = generateGrowthSummary as jest.MockedFunction<typeof generateGrowthSummary>

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse
}

const MANAGER_ID = 'mgr-1'
const TEAMMATE_ID = 'tm-1'

const sampleSummary = {
  teammateName: 'Alex Kim',
  generatedAt: '2026-03-02T00:00:00.000Z',
  narrative: 'Strong growth trajectory.',
  keyThemes: ['Design Systems'],
  growthSignals: ['Faster delivery'],
  coachingGaps: ['Stakeholder alignment'],
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/timeline/[teammateId]/summary', () => {
  it('returns 405 for non-POST method', async () => {
    const req = { method: 'GET', query: { teammateId: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 404 when teammate not found', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue(null)
    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 422 when EmptyHistoryError is thrown', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockGenerate.mockRejectedValue(new EmptyHistoryError())
    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(422)
    expect(res.json).toHaveBeenCalledWith({ error: 'no_history' })
  })

  it('returns 200 with GrowthSummary on Claude success', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockGenerate.mockResolvedValue(sampleSummary)
    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ summary: sampleSummary })
  })

  it('returns 200 with null summary on Claude failure (P-5.02 graceful degradation)', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockGenerate.mockResolvedValue(null)
    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ summary: null })
  })

  it('returns 500 on unexpected DB error', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockGenerate.mockRejectedValue(new Error('DB connection failed'))
    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('passes correct managerId and teammateId to generateGrowthSummary', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockGenerate.mockResolvedValue(sampleSummary)
    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(mockGenerate).toHaveBeenCalledWith(MANAGER_ID, TEAMMATE_ID)
  })
})
