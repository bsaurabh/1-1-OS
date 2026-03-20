import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'

export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  managerId: string
) {
  const { id } = req.query
  if (typeof id !== 'string') return sendError(res, 400, 'Invalid id')

  const { prisma } = await import('@/lib/prisma')

  if (req.method === 'GET') {
    try {
      const analysis = await prisma.excelAnalysis.findUnique({ where: { id } })
      if (!analysis || analysis.managerId !== managerId) return sendError(res, 404, 'Not found')
      return res.status(200).json({ analysis })
    } catch (err) {
      console.error('[insights/[id]] GET error:', err)
      return sendError(res, 500, INTERNAL_ERROR)
    }
  }

  if (req.method === 'DELETE') {
    try {
      const analysis = await prisma.excelAnalysis.findUnique({ where: { id }, select: { managerId: true } })
      if (!analysis || analysis.managerId !== managerId) return sendError(res, 404, 'Not found')
      await prisma.excelAnalysis.delete({ where: { id } })
      return res.status(204).end()
    } catch (err) {
      console.error('[insights/[id]] DELETE error:', err)
      return sendError(res, 500, INTERNAL_ERROR)
    }
  }

  return sendError(res, 405, 'Method not allowed')
})
