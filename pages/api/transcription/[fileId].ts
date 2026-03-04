import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { discardAudio } from '@/lib/transcription'
import { sendError } from '@/lib/apiError'

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  if (req.method !== 'DELETE') return sendError(res, 405 as never, 'Method not allowed')

  const fileId = req.query.fileId as string

  await discardAudio(managerId, fileId)
  return res.status(204).end()
}

export default withAuth(handler)
