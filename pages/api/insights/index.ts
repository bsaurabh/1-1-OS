import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'

export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  managerId: string
) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed')

  try {
    const { prisma } = await import('@/lib/prisma')
    const analyses = await prisma.excelAnalysis.findMany({
      where: { managerId },
      orderBy: { analysedAt: 'desc' },
      select: {
        id: true,
        filename: true,
        sheetName: true,
        rowCount: true,
        analysedAt: true,
        status: true,
      },
    })
    return res.status(200).json({ analyses })
  } catch (err) {
    console.error('[insights] list error:', err)
    return sendError(res, 500, INTERNAL_ERROR)
  }
})
