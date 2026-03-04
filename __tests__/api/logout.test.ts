import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/auth/logout'

jest.mock('@/lib/cookies', () => ({
  clearSessionCookie: jest.fn(),
}))

import { clearSessionCookie } from '@/lib/cookies'

function mockReqRes(method = 'POST') {
  const req = { method } as unknown as NextApiRequest
  let statusCode = 0
  let responseBody: unknown = null
  const res = {
    status: (code: number) => ({ json: (data: unknown) => { statusCode = code; responseBody = data } }),
    setHeader: jest.fn(),
  } as unknown as NextApiResponse
  return { req, res, getStatus: () => statusCode, getBody: () => responseBody }
}

describe('POST /api/auth/logout', () => {
  it('clears session cookie and returns 200', async () => {
    const { req, res, getStatus, getBody } = mockReqRes()
    handler(req, res)
    expect(clearSessionCookie).toHaveBeenCalled()
    expect(getStatus()).toBe(200)
    expect((getBody() as any).ok).toBe(true)
  })

  it('returns 405 for non-POST methods', async () => {
    const { req, res, getStatus } = mockReqRes('GET')
    handler(req, res)
    expect(getStatus()).toBe(405)
  })
})
