import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { confirm, dismiss, updateStatus, deleteCommitment } from '@/lib/commitments'
import { sendError } from '@/lib/apiError'

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  const id = req.query.id as string

  // P-5.04: Extended Action Dispatch — PATCH handles all commitment mutations
  if (req.method === 'PATCH') {
    const { action, text } = req.body as { action?: string; text?: string }

    // Unit 3 actions
    if (action === 'confirm') {
      const commitment = await confirm(managerId, id, text)
      if (!commitment) return sendError(res, 404, 'Commitment not found')
      return res.status(200).json({ commitment })
    }
    if (action === 'dismiss') {
      const deleted = await dismiss(managerId, id)
      if (!deleted) return sendError(res, 404, 'Commitment not found')
      return res.status(200).json({ success: true })
    }

    // Unit 5 actions
    if (action === 'done' || action === 'carried_forward' || action === 'dropped') {
      try {
        const commitment = await updateStatus(managerId, id, action)
        if (!commitment) return sendError(res, 404, 'Commitment not found')
        return res.status(200).json({ commitment })
      } catch (err) {
        console.error('[commitments/[id] PATCH] error:', err)
        return sendError(res, 500, 'Something went wrong. Please try again.')
      }
    }

    return sendError(res, 400, 'action must be one of: confirm, dismiss, done, carried_forward, dropped')
  }

  if (req.method === 'DELETE') {
    try {
      const deleted = await deleteCommitment(managerId, id)
      if (!deleted) return sendError(res, 404, 'Commitment not found')
      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('[commitments/[id] DELETE] error:', err)
      return sendError(res, 500, 'Something went wrong. Please try again.')
    }
  }

  return sendError(res, 405 as never, 'Method not allowed')
}

export default withAuth(handler)
