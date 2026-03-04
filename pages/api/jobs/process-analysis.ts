import type { NextApiRequest, NextApiResponse } from 'next'
import { processNext } from '@/lib/analysisQueue'
import { analyze } from '@/handlers/meetingAnalysisHandler'
import { notifyAnalysisComplete, notifyAnalysisFailed } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

export const config = {
  api: { maxDuration: 60 },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers['authorization']
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log('[cron] process-analysis triggered')

  try {
    let permanentFailMeetingId: string | null = null

    const result = await processNext(async (meetingId: string) => {
      await analyze(meetingId)

      // Notify on success
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { managerId: true, status: true },
      })
      if (meeting?.status === 'ANALYSIS_COMPLETE') {
        await notifyAnalysisComplete(meeting.managerId, meetingId)
      } else if (meeting?.status === 'ANALYSIS_FAILED') {
        permanentFailMeetingId = meetingId
        await notifyAnalysisFailed(meeting.managerId)
      }
    })

    return res.status(200).json(result)
  } catch (err) {
    console.error('[cron] process-analysis error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
