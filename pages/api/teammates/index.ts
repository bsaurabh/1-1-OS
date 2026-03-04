import type { NextApiRequest, NextApiResponse } from 'next'
import { verifySessionToken } from '@/lib/auth'
import { createTeammate, listTeammates } from '@/lib/teammates'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies['session']
  if (!token) return sendError(res, 401, 'Unauthorized.')

  let managerId: string
  try {
    const payload = await verifySessionToken(token)
    managerId = payload.managerId
  } catch {
    return sendError(res, 401, 'Unauthorized.')
  }

  if (req.method === 'GET') {
    try {
      const teammates = await listTeammates(managerId)
      return res.status(200).json({ teammates })
    } catch (err) {
      console.error('[GET /api/teammates]', err)
      return sendError(res, 500, INTERNAL_ERROR)
    }
  }

  if (req.method === 'POST') {
    const { name, role } = req.body as { name?: string; role?: string }

    if (!name || name.trim().length === 0) {
      return sendError(res, 400, 'Name is required.')
    }
    if (name.trim().length > 100) {
      return sendError(res, 400, 'Name must be under 100 characters.')
    }
    if (!role || role.trim().length === 0) {
      return sendError(res, 400, 'Role is required.')
    }
    if (role.trim().length > 100) {
      return sendError(res, 400, 'Role must be under 100 characters.')
    }

    try {
      const teammate = await createTeammate(managerId, name.trim(), role.trim())
      return res.status(201).json(teammate)
    } catch (err) {
      console.error('[POST /api/teammates]', err)
      return sendError(res, 500, INTERNAL_ERROR)
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return sendError(res, 405, 'Method not allowed.')
}
