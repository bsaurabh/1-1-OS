import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { createCommitment, listOpen, listResolved } from '@/lib/commitments'
import { sendError } from '@/lib/apiError'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  const teammateId = req.query.id as string

  // Verify teammate ownership
  const teammate = await prisma.teammate.findFirst({
    where: { id: teammateId, managerId },
    select: { id: true },
  })
  if (!teammate) return sendError(res, 404, 'Teammate not found')

  if (req.method === 'GET') {
    const { status } = req.query
    if (status === 'open') {
      const commitments = await listOpen(managerId, teammateId)
      return res.status(200).json({ commitments })
    }
    if (status === 'resolved') {
      const commitments = await listResolved(managerId, teammateId)
      return res.status(200).json({ commitments })
    }
    return sendError(res, 400, 'status must be open or resolved')
  }

  if (req.method === 'POST') {
    const { text, owner, dueDate } = req.body as {
      text?: string
      owner?: string
      dueDate?: string | null
    }

    if (!text || !owner || (owner !== 'MANAGER' && owner !== 'TEAMMATE')) {
      return sendError(res, 400, 'text and owner are required')
    }

    try {
      const result = await createCommitment(managerId, teammateId, text, owner, dueDate)
      if ('duplicate' in result) {
        return res.status(409).json({ duplicate: true, existingId: result.existingId })
      }
      return res.status(201).json({ commitment: result.commitment })
    } catch (err) {
      console.error('[teammates/[id]/commitments POST] error:', err)
      return sendError(res, 500, 'Something went wrong. Please try again.')
    }
  }

  return sendError(res, 405 as never, 'Method not allowed')
}

export default withAuth(handler)
