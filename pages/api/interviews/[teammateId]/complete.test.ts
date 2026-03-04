import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './complete'
import { ProfileArea } from '@/handlers/interviewAIHandler'
import type { ConversationTurn } from '@/handlers/interviewAIHandler'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  verifySessionToken: jest.fn(),
}))

jest.mock('@/lib/teammates', () => ({
  getTeammate:    jest.fn(),
  updateTeammate: jest.fn(),
}))

jest.mock('@/handlers/interviewAIHandler', () => ({
  ...jest.requireActual('@/handlers/interviewAIHandler'),
  generateProfile: jest.fn(),
}))

import { verifySessionToken } from '@/lib/auth'
import { getTeammate, updateTeammate } from '@/lib/teammates'
import { generateProfile } from '@/handlers/interviewAIHandler'

const mockVerify          = verifySessionToken as jest.Mock
const mockGetTeammate     = getTeammate        as jest.Mock
const mockUpdateTeammate  = updateTeammate     as jest.Mock
const mockGenerateProfile = generateProfile    as jest.Mock

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTurn(index: number): ConversationTurn {
  return {
    questionIndex: index,
    area:          ProfileArea.STRENGTHS,
    question:      `Question ${index}`,
    answer:        `Answer ${index}`,
  }
}

const FULL_HISTORY: ConversationTurn[] = Array.from({ length: 7 }, (_, i) => makeTurn(i + 1))

function makeReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method:  'POST',
    cookies: { session: 'valid-token' },
    query:   { teammateId: 'tm-1' },
    body:    { conversationHistory: FULL_HISTORY },
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

const SYNTHESIZED_PROFILE = {
  strengths:            'Systems thinking',
  growthAreas:          'Communication',
  aspirations:          'Lead design team',
  kpis:                 'NPS, velocity',
  behavioralTendencies: 'Introvert',
  feedbackStyle:        'Direct',
  motivationDrivers:    'Craft and impact',
}

// ─── Shared setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  mockVerify.mockResolvedValue({ managerId: 'mgr-1' })
  mockGetTeammate.mockResolvedValue(TEAMMATE)
  mockUpdateTeammate.mockResolvedValue({ ...TEAMMATE, profile: SYNTHESIZED_PROFILE, profileCompleteness: 8 })
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

    expect((res as any).status).toHaveBeenCalledWith(404)
  })
})

// ─── Input validation ─────────────────────────────────────────────────────────

describe('input validation', () => {
  it('returns 400 when conversationHistory is missing', async () => {
    const req = makeReq({ body: {} })
    const res = makeRes()
    await handler(req, res)
    expect((res as any).status).toHaveBeenCalledWith(400)
    expect((res as any).json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Exactly 7 conversation turns are required.' }),
    )
  })

  it('returns 400 when conversationHistory has fewer than 7 turns', async () => {
    const req = makeReq({ body: { conversationHistory: [makeTurn(1)] } })
    const res = makeRes()
    await handler(req, res)
    expect((res as any).status).toHaveBeenCalledWith(400)
  })

  it('returns 400 when conversationHistory has more than 7 turns', async () => {
    const history = Array.from({ length: 8 }, (_, i) => makeTurn(i + 1))
    const req = makeReq({ body: { conversationHistory: history } })
    const res = makeRes()
    await handler(req, res)
    expect((res as any).status).toHaveBeenCalledWith(400)
  })

  it('returns 400 when conversationHistory is not an array', async () => {
    const req = makeReq({ body: { conversationHistory: 'invalid' } })
    const res = makeRes()
    await handler(req, res)
    expect((res as any).status).toHaveBeenCalledWith(400)
  })
})

// ─── Successful synthesis ─────────────────────────────────────────────────────

describe('POST /api/interviews/[teammateId]/complete', () => {
  it('returns 200 with synthesized profile on success', async () => {
    mockGenerateProfile.mockResolvedValue({ profile: SYNTHESIZED_PROFILE })

    const req = makeReq()
    const res = makeRes()
    await handler(req, res)

    expect(mockGenerateProfile).toHaveBeenCalledWith('Alice', 'Designer', FULL_HISTORY)
    expect(mockUpdateTeammate).toHaveBeenCalledWith('mgr-1', 'tm-1', { profile: SYNTHESIZED_PROFILE })
    expect((res as any).status).toHaveBeenCalledWith(200)
    expect((res as any).json).toHaveBeenCalledWith({ profile: SYNTHESIZED_PROFILE })
  })

  it('includes warning in response when generateProfile returns a warning', async () => {
    mockGenerateProfile.mockResolvedValue({
      profile:  { _rawAnswers: FULL_HISTORY },
      warning:  'Profile auto-fill failed. Raw answers preserved.',
    })

    const req = makeReq()
    const res = makeRes()
    await handler(req, res)

    expect((res as any).status).toHaveBeenCalledWith(200)
    expect((res as any).json).toHaveBeenCalledWith(
      expect.objectContaining({ warning: expect.stringContaining('auto-fill failed') }),
    )
  })

  it('omits warning key when generateProfile returns no warning', async () => {
    mockGenerateProfile.mockResolvedValue({ profile: SYNTHESIZED_PROFILE })

    const req = makeReq()
    const res = makeRes()
    await handler(req, res)

    const jsonArg = (res as any).json.mock.calls[0][0]
    expect(jsonArg).not.toHaveProperty('warning')
  })
})

// ─── Claude error → 503 fallback ─────────────────────────────────────────────

describe('Claude error handling', () => {
  it('returns 503 with fallback flag when generateProfile throws', async () => {
    mockGenerateProfile.mockRejectedValue(new Error('Claude error'))

    const req = makeReq()
    const res = makeRes()
    await handler(req, res)

    expect((res as any).status).toHaveBeenCalledWith(503)
    expect((res as any).json).toHaveBeenCalledWith(
      expect.objectContaining({ fallback: true }),
    )
  })
})
