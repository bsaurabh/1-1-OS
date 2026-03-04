import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { verifyPassword, DUMMY_HASH } from '@/lib/password'
import { signSessionToken } from '@/lib/auth'
import { setSessionCookie } from '@/lib/cookies'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'

const AUTH_ERROR = 'Incorrect email or password.'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return sendError(res, 400, AUTH_ERROR)
  }

  const normalizedEmail = email.trim().toLowerCase()

  try {
    const manager = await prisma.manager.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, passwordHash: true },
    })

    // Always run bcrypt even if manager not found (prevents timing-based enumeration)
    const hashToCompare = manager?.passwordHash ?? DUMMY_HASH
    const isValid = await verifyPassword(password, hashToCompare)

    if (!manager || !isValid) {
      return sendError(res, 401, AUTH_ERROR)
    }

    const token = await signSessionToken({ managerId: manager.id, email: manager.email })
    setSessionCookie(res, token)

    return res.status(200).json({ managerId: manager.id })
  } catch (error) {
    console.error('[/api/auth/login]', error)
    return sendError(res, 500, INTERNAL_ERROR)
  }
}
