import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { sendError } from '@/lib/apiError'
import { getCritique, updateCritiqueStatus } from '@/lib/critique'
import { generateCritique } from '@/handlers/designCritiqueHandler'

export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  managerId: string
) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed')
  }

  const id = req.query.id as string

  const critique = await getCritique(managerId, id)
  if (!critique) return sendError(res, 404, 'Critique not found')

  // Already done — return result
  if (critique.status === 'COMPLETE') {
    return res.status(200).json({ status: 'COMPLETE', result: critique.result })
  }

  // Already in progress — just return status
  if (critique.status === 'ANALYZING') {
    return res.status(200).json({ status: 'ANALYZING' })
  }

  // Start async analysis — respond immediately
  await updateCritiqueStatus(id, 'ANALYZING')
  res.status(202).json({ status: 'ANALYZING' })

  // Fire-and-forget: run the critique in the background
  generateCritique(
    {
      featureName: critique.featureName,
      userType: critique.userType,
      featureGoal: critique.featureGoal,
      successMetric: critique.successMetric,
      constraints: critique.constraints,
      stage: critique.stage as 'EXPLORATORY' | 'FINAL_POLISH',
      focusAreas: critique.focusAreas,
      imageCount: critique.imageUrls.length,
    },
    critique.imageUrls
  )
    .then(async (result) => {
      await updateCritiqueStatus(id, 'COMPLETE', result)
      console.log(`[critique] ${id} analysis complete`)
    })
    .catch(async (err) => {
      console.error('[critique] generate error:', err)
      await updateCritiqueStatus(id, 'FAILED').catch(() => {})
    })
})
