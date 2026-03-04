import { setSessionCookie, clearSessionCookie } from '@/lib/cookies'
import type { NextApiResponse } from 'next'

function mockResponse() {
  const headers: Record<string, string | string[]> = {}
  return {
    setHeader: (key: string, value: string | string[]) => {
      headers[key] = value
    },
    getHeaders: () => headers,
  } as unknown as NextApiResponse
}

describe('cookie utilities', () => {
  describe('setSessionCookie', () => {
    it('sets Set-Cookie header with HttpOnly and SameSite=Lax', () => {
      const res = mockResponse()
      setSessionCookie(res, 'test-token')
      const cookie = (res as any).getHeaders()['Set-Cookie'] as string
      expect(cookie).toContain('session=test-token')
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=Lax')
      expect(cookie).toContain('Path=/')
    })

    it('does not include Secure flag in development', () => {
      const originalEnv = process.env.NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })
      const res = mockResponse()
      setSessionCookie(res, 'test-token')
      const cookie = (res as any).getHeaders()['Set-Cookie'] as string
      expect(cookie).not.toContain('Secure')
      Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true })
    })
  })

  describe('clearSessionCookie', () => {
    it('sets Max-Age=0 to expire the cookie', () => {
      const res = mockResponse()
      clearSessionCookie(res)
      const cookie = (res as any).getHeaders()['Set-Cookie'] as string
      expect(cookie).toContain('session=')
      expect(cookie).toContain('Max-Age=0')
    })
  })
})
