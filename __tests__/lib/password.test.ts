import { hashPassword, verifyPassword, DUMMY_HASH } from '@/lib/password'

describe('password utilities', () => {
  describe('hashPassword', () => {
    it('returns a bcrypt hash string', async () => {
      const hash = await hashPassword('password123')
      expect(hash).toMatch(/^\$2[ab]\$12\$/)
    })

    it('produces different hashes for the same input (salt)', async () => {
      const hash1 = await hashPassword('password123')
      const hash2 = await hashPassword('password123')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyPassword', () => {
    it('returns true for correct password', async () => {
      const hash = await hashPassword('correct-password')
      expect(await verifyPassword('correct-password', hash)).toBe(true)
    })

    it('returns false for wrong password', async () => {
      const hash = await hashPassword('correct-password')
      expect(await verifyPassword('wrong-password', hash)).toBe(false)
    })

    it('returns false when compared against DUMMY_HASH', async () => {
      expect(await verifyPassword('any-password', DUMMY_HASH)).toBe(false)
    })
  })

  describe('DUMMY_HASH', () => {
    it('is a valid bcrypt hash string', () => {
      expect(DUMMY_HASH).toMatch(/^\$2[ab]\$12\$/)
    })
  })
})
