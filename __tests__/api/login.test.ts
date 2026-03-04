import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/auth/login'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    manager: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/password', () => ({
  verifyPassword: jest.fn(),
  DUMMY_HASH: '$2a$12$dummy',
}))
jest.mock('@/lib/auth', () => ({
  signSessionToken: jest.fn().mockResolvedValue('mock-token'),
}))
jest.mock('@/lib/cookies', () => ({
  setSessionCookie: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'

function mockReqRes(body: object) {
  const req = { method: 'POST', body } as unknown as NextApiRequest
  let statusCode = 0
  let responseBody: unknown = null
  const res = {
    status: (code: number) => ({ json: (data: unknown) => { statusCode = code; responseBody = data } }),
    setHeader: jest.fn(),
  } as unknown as NextApiResponse
  return { req, res, getStatus: () => statusCode, getBody: () => responseBody }
}

describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when email not found (runs DUMMY_HASH path)', async () => {
    ;(prisma.manager.findUnique as jest.Mock).mockResolvedValue(null)
    ;(verifyPassword as jest.Mock).mockResolvedValue(false)
    const { req, res, getStatus, getBody } = mockReqRes({ email: 'ghost@example.com', password: 'anything' })
    await handler(req, res)
    expect(verifyPassword).toHaveBeenCalled()
    expect(getStatus()).toBe(401)
    expect((getBody() as any).error).toBe('Incorrect email or password.')
  })

  it('returns 401 for wrong password', async () => {
    ;(prisma.manager.findUnique as jest.Mock).mockResolvedValue({
      id: 'mgr_1',
      email: 'user@example.com',
      passwordHash: '$2a$12$real-hash',
    })
    ;(verifyPassword as jest.Mock).mockResolvedValue(false)
    const { req, res, getStatus, getBody } = mockReqRes({ email: 'user@example.com', password: 'wrong' })
    await handler(req, res)
    expect(getStatus()).toBe(401)
    expect((getBody() as any).error).toBe('Incorrect email or password.')
  })

  it('returns 200 with managerId on successful login', async () => {
    ;(prisma.manager.findUnique as jest.Mock).mockResolvedValue({
      id: 'mgr_1',
      email: 'user@example.com',
      passwordHash: '$2a$12$real-hash',
    })
    ;(verifyPassword as jest.Mock).mockResolvedValue(true)
    const { req, res, getStatus, getBody } = mockReqRes({ email: 'user@example.com', password: 'correct' })
    await handler(req, res)
    expect(getStatus()).toBe(200)
    expect((getBody() as any).managerId).toBe('mgr_1')
  })
})
