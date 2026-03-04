import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    manager: { findUnique: jest.fn() },
    passwordResetToken: { create: jest.fn() },
  },
}))
jest.mock('@/lib/email', () => ({
  sendPasswordResetEmail: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'

// Import after mocks
let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>

beforeAll(async () => {
  handler = (await import('@/pages/api/auth/forgot-password')).default
})

function mockReqRes(body: object) {
  const req = { method: 'POST', body } as unknown as NextApiRequest
  let statusCode = 0
  let responseBody: unknown = null
  const res = {
    status: (code: number) => ({ json: (data: unknown) => { statusCode = code; responseBody = data } }),
    json: (data: unknown) => { statusCode = 200; responseBody = data },
    setHeader: jest.fn(),
  } as unknown as NextApiResponse
  return { req, res, getStatus: () => statusCode, getBody: () => responseBody }
}

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => jest.clearAllMocks())

  it('always returns 200 regardless of email existence', async () => {
    ;(prisma.manager.findUnique as jest.Mock).mockResolvedValue(null)
    const { req, res, getStatus } = mockReqRes({ email: 'ghost@example.com' })
    await handler(req, res)
    expect(getStatus()).toBe(200)
  })

  it('sends email when manager is found', async () => {
    ;(prisma.manager.findUnique as jest.Mock).mockResolvedValue({ id: 'mgr_1' })
    ;(prisma.passwordResetToken.create as jest.Mock).mockResolvedValue({})
    ;(sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined)
    const { req, res } = mockReqRes({ email: 'real@example.com' })
    await handler(req, res)
    // Allow async work after response
    await new Promise((r) => setTimeout(r, 10))
    expect(sendPasswordResetEmail).toHaveBeenCalled()
  })

  it('returns 200 even when email send fails', async () => {
    ;(prisma.manager.findUnique as jest.Mock).mockResolvedValue({ id: 'mgr_1' })
    ;(prisma.passwordResetToken.create as jest.Mock).mockResolvedValue({})
    ;(sendPasswordResetEmail as jest.Mock).mockRejectedValue(new Error('Resend error'))
    const { req, res, getStatus } = mockReqRes({ email: 'real@example.com' })
    await handler(req, res)
    expect(getStatus()).toBe(200)
  })
})
