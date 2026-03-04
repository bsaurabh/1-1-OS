import bcrypt from 'bcryptjs'

const COST_FACTOR = 12

// Pre-computed hash used when email is not found during login (anti-enumeration timing fix).
// bcrypt.compare will still run its full ~250ms computation, preventing timing-based
// email enumeration attacks.
export const DUMMY_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQJQ9K2'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST_FACTOR)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
