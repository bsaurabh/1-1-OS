import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './generate'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/withAuth', () => ({
  withAuth: (fn: Function) => fn,
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    teammate: { findFirst: jest.fn() },
  },
}))

jest.mock('@/handlers/briefGenerationHandler', () => ({
  generateBrief: jest.fn(),
  EmptyHistoryError: class EmptyHistoryError extends Error {
    constructor() {
      super('No meeting history')
      this.name = 'EmptyHistoryError'
    }
  },
}))

jest.mock('@/lib/apiError', () => ({
  sendError: jest.fn((res: NextApiResponse, status: number, msg: string) => {
    res.status(status).json({ error: msg })
  }),
  INTERNAL_ERROR: 'Internal server error',
}))

import { prisma } from '@/lib/prisma'
import { generateBrief, EmptyHistoryError } from '@/handlers/briefGenerationHandler'

const mockTeammate = prisma.teammate as jest.Mocked<typeof prisma.teammate>
const mockGenerateBrief = generateBrief as jest.MockedFunction<typeof generateBrief>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRes(): NextApiResponse {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/brief/[teammateId]/generate', () => {
  const MANAGER_ID = 'mgr-1'
  const TEAMMATE_ID = 'tm-1'

  beforeEach(() => jest.clearAllMocks())

  it('returns 405 for non-POST methods', async () => {
    const req = { method: 'GET', query: { teammateId: TEAMMATE_ID } } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 404 when teammate not owned by manager (BR-4.17)', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue(null)
    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID } } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 422 with no_history when teammate has no meetings (BR-4.06)', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockGenerateBrief.mockRejectedValue(new EmptyHistoryError())

    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID } } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)

    expect(res.status).toHaveBeenCalledWith(422)
    expect(res.json).toHaveBeenCalledWith({ error: 'no_history' })
  })

  it('returns 200 with brief when generation succeeds', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })

    const mockBrief = {
      teammateId: TEAMMATE_ID,
      generatedAt: new Date().toISOString(),
      contextSummary: 'Alice has been focused on delivery.',
      openCommitments: [],
      patterns: [],
      coachingFocus: 'Explore blockers.',
      riskSignals: [],
      followUpQuestions: ['What went well?'],
      uncomfortableQuestion: 'Do you feel overwhelmed?',
      coachingApproach: { framework: 'GROW', rationale: 'Good fit.', actions: [] },
    }
    mockGenerateBrief.mockResolvedValue({ brief: mockBrief, fallback: null })

    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID } } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ brief: mockBrief, fallback: null })
  })

  it('returns 200 with fallback when Claude generation fails (P-4.03)', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })

    const mockFallback = {
      commitments: [],
      lastMeetingSummary: 'We discussed delivery.',
      lastMeetingDate: new Date().toISOString(),
    }
    mockGenerateBrief.mockResolvedValue({ brief: null, fallback: mockFallback })

    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID } } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ brief: null, fallback: mockFallback })
  })

  it('returns 500 on unexpected error', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockGenerateBrief.mockRejectedValue(new Error('Database connection lost'))

    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID } } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('calls generateBrief with correct managerId and teammateId', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockGenerateBrief.mockResolvedValue({ brief: null, fallback: { commitments: [], lastMeetingSummary: null, lastMeetingDate: null } })

    const req = { method: 'POST', query: { teammateId: TEAMMATE_ID } } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)

    expect(mockGenerateBrief).toHaveBeenCalledWith(MANAGER_ID, TEAMMATE_ID)
  })
})
