import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './[teammateId]'

jest.mock('@/lib/withAuth', () => ({
  withAuth: (fn: Function) => fn,
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    teammate: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/timeline', () => ({
  listTimeline: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { listTimeline } from '@/lib/timeline'

const mockTeammate = prisma.teammate as jest.Mocked<typeof prisma.teammate>
const mockListTimeline = listTimeline as jest.MockedFunction<typeof listTimeline>

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse
}

const MANAGER_ID = 'mgr-1'
const TEAMMATE_ID = 'tm-1'

const sampleEntry = {
  id: 'mtg-1',
  summary: 'Good discussion',
  tags: ['Design'],
  tone: 'Positive',
  status: 'ANALYSIS_COMPLETE',
  createdAt: '2026-02-01T00:00:00.000Z',
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/timeline/[teammateId]', () => {
  it('returns 405 for non-GET method', async () => {
    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 404 when teammate not found', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue(null)
    const req = { method: 'GET', query: { teammateId: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 200 with meetings array', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockListTimeline.mockResolvedValue([sampleEntry])
    const req = { method: 'GET', query: { teammateId: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ meetings: [sampleEntry] })
    expect(mockListTimeline).toHaveBeenCalledWith(MANAGER_ID, TEAMMATE_ID)
  })
})
