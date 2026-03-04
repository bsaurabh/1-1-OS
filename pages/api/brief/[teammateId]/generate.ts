import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { generateBrief, EmptyHistoryError } from '@/handlers/briefGenerationHandler'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'
import { prisma } from '@/lib/prisma'

export const config = {
  api: { maxDuration: 30 },
}

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  if (req.method !== 'POST') return sendError(res, 405 as never, 'Method not allowed')

  const teammateId = req.query.teammateId as string

  // BR-4.17: verify ownership before generating
  const teammate = await prisma.teammate.findFirst({
    where: { id: teammateId, managerId },
    select: { id: true },
  })

  if (!teammate) return sendError(res, 404, 'Teammate not found')

  try {
    const result = await generateBrief(managerId, teammateId)
    return res.status(200).json(result)
  } catch (err) {
    if (err instanceof EmptyHistoryError) {
      return res.status(422).json({ error: 'no_history' })
    }
    console.error('[brief/generate] error:', err)
    return sendError(res, 500, INTERNAL_ERROR)
  }
}

export default withAuth(handler)
