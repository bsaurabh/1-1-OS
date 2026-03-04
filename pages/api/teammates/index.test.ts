import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './index'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  verifySessionToken: jest.fn(),
}))

jest.mock('@/lib/teammates', () => ({
  listTeammates: jest.fn(),
  createTeammate: jest.fn(),
}))

import { verifySessionToken } from '@/lib/auth'
import { listTeammates, createTeammate } from '@/lib/teammates'

const mockVerify  = verifySessionToken as jest.Mock
const mockList    = listTeammates    as jest.Mock
const mockCreate  = createTeammate   as jest.Mock

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method:  'GET',
    cookies: {},
    query:   {},
    body:    {},
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

// ─── Shared setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  mockVerify.mockResolvedValue({ managerId: 'mgr-1' })
})

// ─── Authentication ───────────────────────────────────────────────────────────

describe('authentication', () => {
  it('returns 401 when no session cookie', async () => {
    const req = makeReq({ cookies: {} })
    const res = makeRes()
    await handler(req, res)
    expect((res as any).status).toHaveBeenCalledWith(401)
  })

  it('returns 401 when session token is invalid', async () => {
    mockVerify.mockRejectedValue(new Error('invalid token'))
    const req = makeReq({ cookies: { session: 'bad-token' } })
    const res = makeRes()
    await handler(req, res)
    expect((res as any).status).toHaveBeenCalledWith(401)
  })
})

// ─── GET /api/teammates ───────────────────────────────────────────────────────

describe('GET /api/teammates', () => {
  it('returns 200 with teammates list', async () => {
    const teammates = [{ id: 'tm-1', name: 'Alice', role: 'Designer', profileCompleteness: 1, createdAt: '2024-01-15T00:00:00.000Z' }]
    mockList.mockResolvedValue(teammates)

    const req = makeReq({ method: 'GET', cookies: { session: 'valid-token' } })
    const res = makeRes()
    await handler(req, res)

    expect(mockList).toHaveBeenCalledWith('mgr-1')
    expect((res as any).status).toHaveBeenCalledWith(200)
    expect((res as any).json).toHaveBeenCalledWith({ teammates })
  })

  it('returns 500 when listTeammates throws', async () => {
    mockList.mockRejectedValue(new Error('DB error'))

    const req = makeReq({ method: 'GET', cookies: { session: 'valid-token' } })
    const res = makeRes()
    await handler(req, res)

    expect((res as any).status).toHaveBeenCalledWith(500)
  })
})

// ─── POST /api/teammates ──────────────────────────────────────────────────────

describe('POST /api/teammates', () => {
  function postReq(body: object) {
    return makeReq({ method: 'POST', cookies: { session: 'valid-token' }, body })
  }

  it('returns 400 when name is missing', async () => {
    const res = makeRes()
    await handler(postReq({ role: 'Designer' }), res)
    expect((res as any).status).toHaveBeenCalledWith(400)
    expect((res as any).json).toHaveBeenCalledWith({ error: 'Name is required.' })
  })

  it('returns 400 when name is empty string', async () => {
    const res = makeRes()
    await handler(postReq({ name: '   ', role: 'Designer' }), res)
    expect((res as any).status).toHaveBeenCalledWith(400)
  })

  it('returns 400 when name exceeds 100 characters', async () => {
    const res = makeRes()
    await handler(postReq({ name: 'A'.repeat(101), role: 'Designer' }), res)
    expect((res as any).status).toHaveBeenCalledWith(400)
    expect((res as any).json).toHaveBeenCalledWith({ error: 'Name must be under 100 characters.' })
  })

  it('returns 400 when role is missing', async () => {
    const res = makeRes()
    await handler(postReq({ name: 'Alice' }), res)
    expect((res as any).status).toHaveBeenCalledWith(400)
    expect((res as any).json).toHaveBeenCalledWith({ error: 'Role is required.' })
  })

  it('returns 400 when role exceeds 100 characters', async () => {
    const res = makeRes()
    await handler(postReq({ name: 'Alice', role: 'R'.repeat(101) }), res)
    expect((res as any).status).toHaveBeenCalledWith(400)
    expect((res as any).json).toHaveBeenCalledWith({ error: 'Role must be under 100 characters.' })
  })

  it('returns 201 with created teammate on valid input', async () => {
    const created = { id: 'tm-2', name: 'Alice', role: 'Designer', createdAt: '2024-01-15T00:00:00.000Z' }
    mockCreate.mockResolvedValue(created)

    const res = makeRes()
    await handler(postReq({ name: 'Alice', role: 'Designer' }), res)

    expect(mockCreate).toHaveBeenCalledWith('mgr-1', 'Alice', 'Designer')
    expect((res as any).status).toHaveBeenCalledWith(201)
    expect((res as any).json).toHaveBeenCalledWith(created)
  })

  it('trims whitespace from name and role before creating', async () => {
    mockCreate.mockResolvedValue({ id: 'tm-2', name: 'Alice', role: 'Designer', createdAt: '' })

    const res = makeRes()
    await handler(postReq({ name: '  Alice  ', role: '  Designer  ' }), res)

    expect(mockCreate).toHaveBeenCalledWith('mgr-1', 'Alice', 'Designer')
  })

  it('returns 500 when createTeammate throws', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'))

    const res = makeRes()
    await handler(postReq({ name: 'Alice', role: 'Designer' }), res)

    expect((res as any).status).toHaveBeenCalledWith(500)
  })
})

// ─── Method not allowed ───────────────────────────────────────────────────────

describe('method not allowed', () => {
  it('returns 405 for DELETE requests', async () => {
    const req = makeReq({ method: 'DELETE', cookies: { session: 'valid-token' } })
    const res = makeRes()
    await handler(req, res)
    expect((res as any).status).toHaveBeenCalledWith(405)
    expect((res as any).setHeader).toHaveBeenCalledWith('Allow', ['GET', 'POST'])
  })
})
