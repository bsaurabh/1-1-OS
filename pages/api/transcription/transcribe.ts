import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { transcribeAudio } from '@/lib/transcription'
import { sendError } from '@/lib/apiError'

export const config = {
  api: { maxDuration: 60 },
}

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  if (req.method !== 'POST') return sendError(res, 405 as never, 'Method not allowed')

  const { fileId } = req.body as { fileId?: string }
  if (!fileId) return sendError(res, 400, 'fileId is required')

  try {
    const text = await transcribeAudio(managerId, fileId)
    return res.status(200).json({ text })
  } catch (err) {
    console.error('[transcription/transcribe] error:', err)
    return sendError(res, 500, 'Something went wrong. Please try again.')
  }
}

export default withAuth(handler)
