import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { getAudioUploadUrl } from '@/lib/transcription'
import { sendError } from '@/lib/apiError'

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  if (req.method !== 'GET') return sendError(res, 405 as never, 'Method not allowed')

  try {
    const { uploadUrl, fileId } = await getAudioUploadUrl(managerId)
    return res.status(200).json({ uploadUrl, fileId })
  } catch (err) {
    console.error('[transcription/start] error:', err)
    return sendError(res, 500, 'Something went wrong. Please try again.')
  }
}

export default withAuth(handler)
