import { signSessionToken, verifySessionToken } from '@/lib/auth'

const MOCK_SECRET = 'test-secret-key-at-least-32-chars-long-!!'

beforeEach(() => {
  process.env.SECRET_KEY = MOCK_SECRET
})

afterEach(() => {
  delete process.env.SECRET_KEY
})

describe('auth utilities', () => {
  const payload = { managerId: 'mgr_123', email: 'test@example.com' }

  describe('signSessionToken', () => {
    it('returns a JWT string', async () => {
      const token = await signSessionToken(payload)
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })
  })

  describe('verifySessionToken', () => {
    it('returns the original payload for a valid token', async () => {
      const token = await signSessionToken(payload)
      const result = await verifySessionToken(token)
      expect(result.managerId).toBe(payload.managerId)
      expect(result.email).toBe(payload.email)
    })

    it('throws on a tampered token', async () => {
      const token = await signSessionToken(payload)
      const tampered = token.slice(0, -5) + 'XXXXX'
      await expect(verifySessionToken(tampered)).rejects.toThrow()
    })

    it('throws on a token signed with a different secret', async () => {
      const token = await signSessionToken(payload)
      process.env.SECRET_KEY = 'different-secret-key-at-least-32-chars-!!'
      await expect(verifySessionToken(token)).rejects.toThrow()
    })
  })
})
