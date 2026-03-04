import type { NextApiRequest, NextApiResponse } from 'next'
import { verifySessionToken } from '@/lib/auth'
import { getTeammate, updateTeammate } from '@/lib/teammates'
import { generateProfile } from '@/handlers/interviewAIHandler'
import type { ConversationTurn } from '@/handlers/interviewAIHandler'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'

export const config = { maxDuration: 30 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return sendError(res, 405, 'Method not allowed.')
  }

  const token = req.cookies['session']
  if (!token) return sendError(res, 401, 'Unauthorized.')

  let managerId: string
  try {
    const payload = await verifySessionToken(token)
    managerId = payload.managerId
  } catch {
    return sendError(res, 401, 'Unauthorized.')
  }

  const teammateId = req.query.teammateId as string

  // Verify ownership
  const teammate = await getTeammate(managerId, teammateId)
  if (!teammate) return sendError(res, 404, 'Not found.')

  const { conversationHistory } = req.body as { conversationHistory?: ConversationTurn[] }

  if (!Array.isArray(conversationHistory) || conversationHistory.length !== 7) {
    return sendError(res, 400, 'Exactly 7 conversation turns are required.')
  }

  try {
    const { profile, warning } = await generateProfile(
      teammate.name,
      teammate.role,
      conversationHistory,
    )

    // Persist the synthesized profile
    const updated = await updateTeammate(managerId, teammateId, { profile })
    if (!updated) return sendError(res, 500, INTERNAL_ERROR)

    return res.status(200).json({ profile, ...(warning ? { warning } : {}) })
  } catch (err) {
    console.error('[POST /api/interviews/[id]/complete] Claude error:', err)
    return res.status(503).json({
      fallback: true,
      message:  'AI interview unavailable. You can fill in the profile manually.',
    })
  }
}
