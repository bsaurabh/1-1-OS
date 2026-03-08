import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'
import { listCritiques, createCritique } from '@/lib/critique'

export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  managerId: string
) {
  if (req.method === 'GET') {
    try {
      const critiques = await listCritiques(managerId)
      return res.status(200).json({ critiques })
    } catch (err) {
      console.error('[critique] list error:', err)
      return sendError(res, 500, INTERNAL_ERROR)
    }
  }

  if (req.method === 'POST') {
    const { featureName, userType, featureGoal, successMetric, constraints, stage, focusAreas, imageUrls, figmaUrl } = req.body

    if (!featureName || !userType || !featureGoal || !successMetric) {
      return sendError(res, 400, 'featureName, userType, featureGoal, and successMetric are required.')
    }

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return sendError(res, 400, 'At least one image URL is required.')
    }

    try {
      const id = await createCritique(managerId, {
        featureName,
        userType,
        featureGoal,
        successMetric,
        constraints: constraints || undefined,
        stage: stage === 'FINAL_POLISH' ? 'FINAL_POLISH' : 'EXPLORATORY',
        focusAreas: Array.isArray(focusAreas) ? focusAreas : [],
        imageUrls,
        figmaUrl: figmaUrl || undefined,
      })
      return res.status(201).json({ id })
    } catch (err) {
      console.error('[critique] create error:', err)
      return sendError(res, 500, INTERNAL_ERROR)
    }
  }

  return sendError(res, 405, 'Method not allowed')
})
