import type { NextApiRequest, NextApiResponse } from 'next'
import { verifySessionToken } from '@/lib/auth'
import { getTeammate, updateTeammate, deleteTeammate } from '@/lib/teammates'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'
import type { ProfileFields } from '@/handlers/interviewAIHandler'

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

  const teammateId = req.query.id as string

  if (req.method === 'GET') {
    try {
      const teammate = await getTeammate(managerId, teammateId)
      if (!teammate) return sendError(res, 404, 'Not found.')
      return res.status(200).json(teammate)
    } catch (err) {
      console.error('[GET /api/teammates/[id]]', err)
      return sendError(res, 500, INTERNAL_ERROR)
    }
  }

  if (req.method === 'PATCH') {
    const { name, role, profile } = req.body as {
      name?:    string
      role?:    string
      profile?: Partial<ProfileFields>
    }

    // Validate top-level fields if provided
    if (name !== undefined) {
      if (name.trim().length === 0) return sendError(res, 400, 'Name is required.')
      if (name.trim().length > 100) return sendError(res, 400, 'Name must be under 100 characters.')
    }
    if (role !== undefined) {
      if (role.trim().length === 0) return sendError(res, 400, 'Role is required.')
      if (role.trim().length > 100) return sendError(res, 400, 'Role must be under 100 characters.')
    }

    try {
      const updated = await updateTeammate(managerId, teammateId, {
        name:    name?.trim(),
        role:    role?.trim(),
        profile,
      })
      if (!updated) return sendError(res, 404, 'Not found.')
      return res.status(200).json(updated)
    } catch (err) {
      console.error('[PATCH /api/teammates/[id]]', err)
      return sendError(res, 500, INTERNAL_ERROR)
    }
  }

  if (req.method === 'DELETE') {
    try {
      const deleted = await deleteTeammate(managerId, teammateId)
      if (!deleted) return sendError(res, 404, 'Not found.')
      return res.status(204).end()
    } catch (err) {
      console.error('[DELETE /api/teammates/[id]]', err)
      return sendError(res, 500, INTERNAL_ERROR)
    }
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
  return sendError(res, 405, 'Method not allowed.')
}
