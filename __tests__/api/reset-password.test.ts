import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/auth/reset-password'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    passwordResetToken: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    manager: {
      update: jest.fn(),
    },
  },
}))
jest.mock('@/lib/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('$2a$12$new-hash'),
}))

import { prisma } from '@/lib/prisma'

const VALID_TOKEN = 'a'.repeat(64)
const FUTURE_DATE = new Date(Date.now() + 60 * 60 * 1000)
const PAST_DATE = new Date(Date.now() - 1000)

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

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 for missing token', async () => {
    const { req, res, getStatus } = mockReqRes({ token: '', newPassword: 'newpass123' })
    await handler(req, res)
    expect(getStatus()).toBe(400)
  })

  it('returns 400 for password shorter than 8 chars', async () => {
    const { req, res, getStatus, getBody } = mockReqRes({ token: VALID_TOKEN, newPassword: 'short' })
    await handler(req, res)
    expect(getStatus()).toBe(400)
    expect((getBody() as any).error).toContain('8 characters')
  })

  it('returns 400 when token is not found', async () => {
    ;(prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(null)
    const { req, res, getStatus, getBody } = mockReqRes({ token: VALID_TOKEN, newPassword: 'newpass123' })
    await handler(req, res)
    expect(getStatus()).toBe(400)
    expect((getBody() as any).error).toContain('no longer valid')
  })

  it('returns 400 when token is already used', async () => {
    ;(prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
      id: 'tok_1', managerId: 'mgr_1', expiresAt: FUTURE_DATE, usedAt: new Date(),
    })
    const { req, res, getStatus, getBody } = mockReqRes({ token: VALID_TOKEN, newPassword: 'newpass123' })
    await handler(req, res)
    expect(getStatus()).toBe(400)
    expect((getBody() as any).error).toContain('no longer valid')
  })

  it('returns 400 when token is expired', async () => {
    ;(prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
      id: 'tok_1', managerId: 'mgr_1', expiresAt: PAST_DATE, usedAt: null,
    })
    const { req, res, getStatus, getBody } = mockReqRes({ token: VALID_TOKEN, newPassword: 'newpass123' })
    await handler(req, res)
    expect(getStatus()).toBe(400)
    expect((getBody() as any).error).toContain('expired')
  })

  it('returns 200 and updates password on valid token', async () => {
    ;(prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
      id: 'tok_1', managerId: 'mgr_1', expiresAt: FUTURE_DATE, usedAt: null,
    })
    ;(prisma.passwordResetToken.update as jest.Mock).mockResolvedValue({})
    ;(prisma.manager.update as jest.Mock).mockResolvedValue({})
    const { req, res, getStatus, getBody } = mockReqRes({ token: VALID_TOKEN, newPassword: 'newpass123' })
    await handler(req, res)
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usedAt: expect.any(Date) }) })
    )
    expect(prisma.manager.update).toHaveBeenCalled()
    expect(getStatus()).toBe(200)
    expect((getBody() as any).message).toContain('Password updated')
  })
})
