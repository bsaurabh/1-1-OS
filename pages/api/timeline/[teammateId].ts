import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { listTimeline } from '@/lib/timeline'
import { sendError } from '@/lib/apiError'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  if (req.method !== 'GET') return sendError(res, 405 as never, 'Method not allowed')

  const teammateId = req.query.teammateId as string

  const teammate = await prisma.teammate.findFirst({
    where: { id: teammateId, managerId },
    select: { id: true },
  })
  if (!teammate) return sendError(res, 404, 'Teammate not found')

  const meetings = await listTimeline(managerId, teammateId)
  return res.status(200).json({ meetings })
}

export default withAuth(handler)
