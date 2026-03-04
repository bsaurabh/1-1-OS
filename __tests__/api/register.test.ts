import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/auth/register'

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    manager: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))
jest.mock('@/lib/auth', () => ({
  signSessionToken: jest.fn().mockResolvedValue('mock-token'),
}))
jest.mock('@/lib/cookies', () => ({
  setSessionCookie: jest.fn(),
}))

import { prisma } from '@/lib/prisma'

function mockReqRes(body: object, method = 'POST') {
  const req = { method, body } as unknown as NextApiRequest
  let statusCode = 0
  let responseBody: unknown = null
  const res = {
    status: (code: number) => ({ json: (data: unknown) => { statusCode = code; responseBody = data } }),
    setHeader: jest.fn(),
  } as unknown as NextApiResponse
  return { req, res, getStatus: () => statusCode, getBody: () => responseBody }
}

describe('POST /api/auth/register', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 for invalid email', async () => {
    const { req, res, getStatus, getBody } = mockReqRes({ email: 'not-an-email', password: 'password123' })
    await handler(req, res)
    expect(getStatus()).toBe(400)
    expect((getBody() as any).error).toContain('valid email')
  })

  it('returns 400 for short password', async () => {
    const { req, res, getStatus, getBody } = mockReqRes({ email: 'user@example.com', password: 'short' })
    await handler(req, res)
    expect(getStatus()).toBe(400)
    expect((getBody() as any).error).toContain('8 characters')
  })

  it('returns 409 if email already exists', async () => {
    ;(prisma.manager.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-id' })
    const { req, res, getStatus, getBody } = mockReqRes({ email: 'taken@example.com', password: 'password123' })
    await handler(req, res)
    expect(getStatus()).toBe(409)
    expect((getBody() as any).error).toContain('already exists')
  })

  it('returns 200 with managerId on success', async () => {
    ;(prisma.manager.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.manager.create as jest.Mock).mockResolvedValue({ id: 'new-mgr-id', email: 'new@example.com' })
    const { req, res, getStatus, getBody } = mockReqRes({ email: 'new@example.com', password: 'password123' })
    await handler(req, res)
    expect(getStatus()).toBe(200)
    expect((getBody() as any).managerId).toBe('new-mgr-id')
  })
})
