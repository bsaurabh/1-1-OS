import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './next'
import { ProfileArea } from '@/handlers/interviewAIHandler'
import type { ConversationTurn } from '@/handlers/interviewAIHandler'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  verifySessionToken: jest.fn(),
}))

jest.mock('@/lib/teammates', () => ({
  getTeammate: jest.fn(),
}))

jest.mock('@/handlers/interviewAIHandler', () => ({
  ...jest.requireActual('@/handlers/interviewAIHandler'),
  nextQuestion: jest.fn(),
}))

import { verifySessionToken } from '@/lib/auth'
import { getTeammate } from '@/lib/teammates'
import { nextQuestion } from '@/handlers/interviewAIHandler'

const mockVerify       = verifySessionToken as jest.Mock
const mockGetTeammate  = getTeammate        as jest.Mock
const mockNextQuestion = nextQuestion       as jest.Mock

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method:  'POST',
    cookies: { session: 'valid-token' },
    query:   { teammateId: 'tm-1' },
    body:    { conversationHistory: [], latestAnswer: '' },
    headers: {},
    ...overrides,
  } as unknown as NextApiRequest
}

function makeRes() {
  const res: any = {}
  res.status    = jest.fn().mockReturnValue(res)
  res.json      = jest.fn().mockReturnValue(res)
  res.end       = jest.fn().mockReturnValue(res)
  res.setHeader = jest.fn().mockReturnValue(res)
  return res as NextApiResponse
}

const TEAMMATE = {
  id:                  'tm-1',
  managerId:           'mgr-1',
  name:                'Alice',
  role:                'Designer',
  profile:             null,
  profileCompleteness: 1,
  createdAt:           '2024-01-15T00:00:00.000Z',
  updatedAt:           '2024-01-15T00:00:00.000Z',
}

// ─── Shared setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  mockVerify.mockResolvedValue({ managerId: 'mgr-1' })
  mockGetTeammate.mockResolvedValue(TEAMMATE)
})

// ─── Method guard ─────────────────────────────────────────────────────────────

describe('method guard', () => {
  it('returns 405 for GET requests', async () => {
    const req = makeReq({ method: 'GET' })
    const res = makeRes()
    await handler(req, res)
    expect((res as any).status).toHaveBeenCalledWith(405)
    expect((res as any).setHeader).toHaveBeenCalledWith('Allow', ['POST'])
  })
})

// ─── Authentication ───────────────────────────────────────────────────────────

describe('authentication', () => {
  it('returns 401 when no session cookie', async () => {
    const req = makeReq({ cookies: {} })
    const res = makeRes()
    await handler(req, res)
    expect((res as any).status).toHaveBeenCalledWith(401)
  })

  it('returns 401 when token is invalid', async () => {
    mockVerify.mockRejectedValue(new Error('bad token'))
    const req = makeReq()
    const res = makeRes()
    await handler(req, res)
    expect((res as any).status).toHaveBeenCalledWith(401)
  })
})

// ─── Ownership check ──────────────────────────────────────────────────────────

describe('ownership check', () => {
  it('returns 404 when teammate does not belong to manager', async () => {
    mockGetTeammate.mockResolvedValue(null)

    const req = makeReq()
    const res = makeRes()
    await handler(req, res)

    expect(mockGetTeammate).toHaveBeenCalledWith('mgr-1', 'tm-1')
    expect((res as any).status).toHaveBeenCalledWith(404)
  })
})

// ─── Successful response ──────────────────────────────────────────────────────

describe('POST /api/interviews/[teammateId]/next', () => {
  it('returns 200 with nextQuestion result on first question', async () => {
    const result = {
      questionIndex: 1,
      area:          ProfileArea.STRENGTHS,
      question:      'What are their key strengths?',
      isComplete:    false,
    }
    mockNextQuestion.mockResolvedValue(result)

    const req = makeReq({ body: { conversationHistory: [], latestAnswer: '' } })
    const res = makeRes()
    await handler(req, res)

    expect(mockNextQuestion).toHaveBeenCalledWith('Alice', 'Designer', [], '')
    expect((res as any).status).toHaveBeenCalledWith(200)
    expect((res as any).json).toHaveBeenCalledWith(result)
  })

  it('returns 200 with isComplete when 7 turns sent', async () => {
    const result = { questionIndex: 8, area: ProfileArea.STRENGTHS, question: '', isComplete: true }
    mockNextQuestion.mockResolvedValue(result)

    const history: ConversationTurn[] = Array.from({ length: 7 }, (_, i) => ({
      questionIndex: i + 1,
      area:          ProfileArea.STRENGTHS,
      question:      `Q${i + 1}`,
      answer:        `A${i + 1}`,
    }))

    const req = makeReq({ body: { conversationHistory: history, latestAnswer: 'A7' } })
    const res = makeRes()
    await handler(req, res)

    expect((res as any).status).toHaveBeenCalledWith(200)
    expect((res as any).json).toHaveBeenCalledWith(result)
  })

  it('passes empty defaults when body fields are absent', async () => {
    mockNextQuestion.mockResolvedValue({ questionIndex: 1, area: ProfileArea.STRENGTHS, question: 'Q', isComplete: false })

    const req = makeReq({ body: {} })
    const res = makeRes()
    await handler(req, res)

    expect(mockNextQuestion).toHaveBeenCalledWith('Alice', 'Designer', [], '')
  })
})

// ─── Claude error → 503 fallback ─────────────────────────────────────────────

describe('Claude error handling', () => {
  it('returns 503 with fallback flag when nextQuestion throws', async () => {
    mockNextQuestion.mockRejectedValue(new Error('Claude overloaded'))

    const req = makeReq()
    const res = makeRes()
    await handler(req, res)

    expect((res as any).status).toHaveBeenCalledWith(503)
    expect((res as any).json).toHaveBeenCalledWith(
      expect.objectContaining({ fallback: true }),
    )
  })
})
