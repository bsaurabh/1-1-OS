import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { generateGrowthSummary, EmptyHistoryError } from '@/lib/timeline'
import { sendError } from '@/lib/apiError'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  if (req.method !== 'POST') return sendError(res, 405 as never, 'Method not allowed')

  const teammateId = req.query.teammateId as string

  const teammate = await prisma.teammate.findFirst({
    where: { id: teammateId, managerId },
    select: { id: true },
  })
  if (!teammate) return sendError(res, 404, 'Teammate not found')

  try {
    const summary = await generateGrowthSummary(managerId, teammateId)
    // P-5.02: always 200 — null means Claude failed gracefully
    return res.status(200).json({ summary })
  } catch (err) {
    if (err instanceof EmptyHistoryError) {
      return res.status(422).json({ error: 'no_history' })
    }
    console.error('[timeline/summary] unexpected error:', err)
    return sendError(res, 500, 'Something went wrong. Please try again.')
  }
}

export default withAuth(handler)
