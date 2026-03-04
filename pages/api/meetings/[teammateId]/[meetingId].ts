import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { prisma } from '@/lib/prisma'
import { listSuggested } from '@/lib/commitments'
import { sendError } from '@/lib/apiError'

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  if (req.method !== 'GET') return sendError(res, 405 as never, 'Method not allowed')

  const teammateId = req.query.teammateId as string
  const meetingId = req.query.meetingId as string

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, managerId, teammateId },
    select: {
      id: true,
      status: true,
      themes: true,
      tags: true,
      tone: true,
      summary: true,
      source: true,
      createdAt: true,
    },
  })

  if (!meeting) return sendError(res, 404, 'Meeting not found')

  const commitments = await listSuggested(managerId, teammateId)

  return res.status(200).json({ meeting, commitments })
}

export default withAuth(handler)
