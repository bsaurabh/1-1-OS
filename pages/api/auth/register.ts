import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { signSessionToken } from '@/lib/auth'
import { setSessionCookie } from '@/lib/cookies'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'

// RFC 5322 simplified email regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return sendError(res, 400, 'Please enter a valid email address.')
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return sendError(res, 400, 'Password must be at least 8 characters.')
  }

  const normalizedEmail = email.trim().toLowerCase()

  try {
    const existing = await prisma.manager.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existing) {
      return sendError(res, 409, 'An account with this email already exists.')
    }

    const passwordHash = await hashPassword(password)

    const manager = await prisma.manager.create({
      data: { email: normalizedEmail, passwordHash },
      select: { id: true, email: true },
    })

    const token = await signSessionToken({ managerId: manager.id, email: manager.email })
    setSessionCookie(res, token)

    return res.status(200).json({ managerId: manager.id })
  } catch (error) {
    console.error('[/api/auth/register]', error)
    return sendError(res, 500, INTERNAL_ERROR)
  }
}
