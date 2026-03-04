import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token, newPassword } = req.body

  if (!token || typeof token !== 'string') {
    return sendError(res, 400, 'This link is no longer valid.')
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return sendError(res, 400, 'Password must be at least 8 characters.')
  }

  const tokenHash = hashToken(token)

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, managerId: true, expiresAt: true, usedAt: true },
    })

    if (!resetToken) {
      return sendError(res, 400, 'This link is no longer valid.')
    }

    if (resetToken.usedAt !== null) {
      return sendError(res, 400, 'This link is no longer valid.')
    }

    if (resetToken.expiresAt < new Date()) {
      return sendError(res, 400, 'This link has expired. Please request a new one.')
    }

    // Atomically mark token as used before updating password
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    })

    const passwordHash = await hashPassword(newPassword)

    await prisma.manager.update({
      where: { id: resetToken.managerId },
      data: { passwordHash },
    })

    return res.status(200).json({ message: 'Password updated. Please log in.' })
  } catch (error) {
    console.error('[/api/auth/reset-password]', error)
    return sendError(res, 500, INTERNAL_ERROR)
  }
}
