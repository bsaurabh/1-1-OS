import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'

const SUCCESS_MESSAGE =
  'If an account exists for this email, a reset link has been sent.'

const TOKEN_TTL_MINUTES = 60

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body

  if (!email || typeof email !== 'string') {
    return sendError(res, 400, 'Please enter a valid email address.')
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Always return success — anti-enumeration
  res.status(200).json({ message: SUCCESS_MESSAGE })

  try {
    const manager = await prisma.manager.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (!manager) return

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)

    await prisma.passwordResetToken.create({
      data: { managerId: manager.id, tokenHash, expiresAt },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const resetUrl = `${appUrl}/auth/reset-password?token=${rawToken}`

    try {
      await sendPasswordResetEmail(normalizedEmail, resetUrl)
    } catch (emailError) {
      console.error('[/api/auth/forgot-password] Email send failed:', emailError)
      // Silent failure — response already sent
    }
  } catch (error) {
    console.error('[/api/auth/forgot-password]', error)
    // Silent — response already sent to client
  }
}
