import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'
import { getCritique } from '@/lib/critique'

export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  managerId: string
) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed')
  }

  const id = req.query.id as string

  try {
    const critique = await getCritique(managerId, id)
    if (!critique) return sendError(res, 404, 'Critique not found')
    return res.status(200).json({ critique })
  } catch (err) {
    console.error('[critique] get error:', err)
    return sendError(res, 500, INTERNAL_ERROR)
  }
})
