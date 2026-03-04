import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { ingestPaste } from '@/lib/meetings'
import { sendError } from '@/lib/apiError'
import { analyze } from '@/handlers/meetingAnalysisHandler'

export const config = { api: { maxDuration: 60 } }

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  if (req.method !== 'POST') return sendError(res, 405 as never, 'Method not allowed')

  const teammateId = req.query.teammateId as string
  const { text } = req.body as { text?: string }

  if (!text || text.trim().length < 50) {
    return sendError(res, 400, 'Meeting notes must be at least 50 characters')
  }

  try {
    const meetingId = await ingestPaste(managerId, teammateId, text)
    analyze(meetingId).catch(err => console.error('[paste] analysis error:', err))
    return res.status(200).json({ meetingId })
  } catch (err) {
    const message = (err as Error).message
    if (message === 'Teammate not found') return sendError(res, 404, message)
    console.error('[paste] error:', err)
    return sendError(res, 500, 'Something went wrong. Please try again.')
  }
}

export default withAuth(handler)
