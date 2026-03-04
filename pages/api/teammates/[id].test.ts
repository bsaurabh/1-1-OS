import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './[id]'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  verifySessionToken: jest.fn(),
}))

jest.mock('@/lib/teammates', () => ({
  getTeammate:    jest.fn(),
  updateTeammate: jest.fn(),
  deleteTeammate: jest.fn(),
}))

import { verifySessionToken } from '@/lib/auth'
import { getTeammate, updateTeammate, deleteTeammate } from '@/lib/teammates'

const mockVerify  = verifySessionToken as jest.Mock
const mockGet     = getTeammate    as jest.Mock
const mockUpdate  = updateTeammate as jest.Mock
const mockDelete  = deleteTeammate as jest.Mock

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method:  'GET',
    cookies: { session: 'valid-token' },
    query:   { id: 'tm-1' },
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

const TEAMMATE_DETAIL = {
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

// ─── GET /api/teammates/[id] ──────────────────────────────────────────────────

describe('GET /api/teammates/[id]', () => {
  it('returns 200 with teammate detail when found', async () => {
    mockGet.mockResolvedValue(TEAMMATE_DETAIL)

    const req = makeReq({ method: 'GET' })
    const res = makeRes()
    await handler(req, res)

    expect(mockGet).toHaveBeenCalledWith('mgr-1', 'tm-1')
    expect((res as any).status).toHaveBeenCalledWith(200)
    expect((res as any).json).toHaveBeenCalledWith(TEAMMATE_DETAIL)
  })

  it('returns 404 when teammate not found', async () => {
    mockGet.mockResolvedValue(null)

    const req = makeReq({ method: 'GET' })
    const res = makeRes()
    await handler(req, res)

    expect((res as any).status).toHaveBeenCalledWith(404)
  })
})

// ─── PATCH /api/teammates/[id] ────────────────────────────────────────────────

describe('PATCH /api/teammates/[id]', () => {
  function patchReq(body: object) {
    return makeReq({ method: 'PATCH', body })
  }

  it('returns 400 when name is empty', async () => {
    const res = makeRes()
    await handler(patchReq({ name: '' }), res)
    expect((res as any).status).toHaveBeenCalledWith(400)
    expect((res as any).json).toHaveBeenCalledWith({ error: 'Name is required.' })
  })

  it('returns 400 when name exceeds 100 characters', async () => {
    const res = makeRes()
    await handler(patchReq({ name: 'A'.repeat(101) }), res)
    expect((res as any).status).toHaveBeenCalledWith(400)
    expect((res as any).json).toHaveBeenCalledWith({ error: 'Name must be under 100 characters.' })
  })

  it('returns 400 when role is empty', async () => {
    const res = makeRes()
    await handler(patchReq({ role: '' }), res)
    expect((res as any).status).toHaveBeenCalledWith(400)
    expect((res as any).json).toHaveBeenCalledWith({ error: 'Role is required.' })
  })

  it('returns 400 when role exceeds 100 characters', async () => {
    const res = makeRes()
    await handler(patchReq({ role: 'R'.repeat(101) }), res)
    expect((res as any).status).toHaveBeenCalledWith(400)
    expect((res as any).json).toHaveBeenCalledWith({ error: 'Role must be under 100 characters.' })
  })

  it('returns 200 with updated teammate on valid patch', async () => {
    const updated = { ...TEAMMATE_DETAIL, name: 'Bob' }
    mockUpdate.mockResolvedValue(updated)

    const res = makeRes()
    await handler(patchReq({ name: 'Bob' }), res)

    expect(mockUpdate).toHaveBeenCalledWith('mgr-1', 'tm-1', {
      name:    'Bob',
      role:    undefined,
      profile: undefined,
    })
    expect((res as any).status).toHaveBeenCalledWith(200)
    expect((res as any).json).toHaveBeenCalledWith(updated)
  })

  it('returns 200 when updating profile fields', async () => {
    const profile = { strengths: 'Systems thinking' }
    const updated = { ...TEAMMATE_DETAIL, profile }
    mockUpdate.mockResolvedValue(updated)

    const res = makeRes()
    await handler(patchReq({ profile }), res)

    expect(mockUpdate).toHaveBeenCalledWith('mgr-1', 'tm-1', {
      name:    undefined,
      role:    undefined,
      profile,
    })
    expect((res as any).status).toHaveBeenCalledWith(200)
  })

  it('returns 404 when teammate not found', async () => {
    mockUpdate.mockResolvedValue(null)

    const res = makeRes()
    await handler(patchReq({ name: 'Bob' }), res)

    expect((res as any).status).toHaveBeenCalledWith(404)
  })
})

// ─── DELETE /api/teammates/[id] ───────────────────────────────────────────────

describe('DELETE /api/teammates/[id]', () => {
  it('returns 204 on successful delete', async () => {
    mockDelete.mockResolvedValue(true)

    const req = makeReq({ method: 'DELETE' })
    const res = makeRes()
    await handler(req, res)

    expect(mockDelete).toHaveBeenCalledWith('mgr-1', 'tm-1')
    expect((res as any).status).toHaveBeenCalledWith(204)
    expect((res as any).end).toHaveBeenCalled()
  })

  it('returns 404 when teammate not found', async () => {
    mockDelete.mockResolvedValue(false)

    const req = makeReq({ method: 'DELETE' })
    const res = makeRes()
    await handler(req, res)

    expect((res as any).status).toHaveBeenCalledWith(404)
  })
})

// ─── Method not allowed ───────────────────────────────────────────────────────

describe('method not allowed', () => {
  it('returns 405 for POST requests', async () => {
    const req = makeReq({ method: 'POST' })
    const res = makeRes()
    await handler(req, res)
    expect((res as any).status).toHaveBeenCalledWith(405)
    expect((res as any).setHeader).toHaveBeenCalledWith('Allow', ['GET', 'PATCH', 'DELETE'])
  })
})
