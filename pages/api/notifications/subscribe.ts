import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { subscribe, unsubscribe } from '@/lib/notifications'
import { sendError } from '@/lib/apiError'

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  if (req.method === 'POST') {
    const { subscription } = req.body as { subscription?: object }
    if (!subscription) return sendError(res, 400, 'subscription is required')
    await subscribe(managerId, subscription)
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    await unsubscribe(managerId)
    return res.status(200).json({ success: true })
  }

  return sendError(res, 405 as never, 'Method not allowed')
}

export default withAuth(handler)
