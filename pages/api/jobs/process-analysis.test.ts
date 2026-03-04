import type { NextApiRequest, NextApiResponse } from 'next'
import processAnalysisHandler from './process-analysis'

jest.mock('@/lib/analysisQueue', () => ({
  processNext: jest.fn(),
}))

jest.mock('@/handlers/meetingAnalysisHandler', () => ({
  analyze: jest.fn(),
}))

jest.mock('@/lib/notifications', () => ({
  notifyAnalysisComplete: jest.fn(),
  notifyAnalysisFailed: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    meeting: { findUnique: jest.fn() },
  },
}))

import { processNext } from '@/lib/analysisQueue'

const mockProcessNext = processNext as jest.MockedFunction<typeof processNext>

const CRON_SECRET = 'test-cron-secret'

function makeReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'GET',
    headers: { authorization: `Bearer ${CRON_SECRET}` },
    body: {},
    query: {},
    ...overrides,
  } as unknown as NextApiRequest
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse
}

describe('GET /api/jobs/process-analysis', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = CRON_SECRET
  })

  beforeEach(() => jest.clearAllMocks())

  it('returns 405 for non-GET method', async () => {
    const req = makeReq({ method: 'POST' })
    const res = makeRes()
    await processAnalysisHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 401 when CRON_SECRET missing from header', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer wrong-secret' } })
    const res = makeRes()
    await processAnalysisHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 401 when no Authorization header', async () => {
    const req = makeReq({ headers: {} })
    const res = makeRes()
    await processAnalysisHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 200 with processed: 0 when no jobs in queue', async () => {
    mockProcessNext.mockResolvedValueOnce({ processed: 0 })
    const req = makeReq()
    const res = makeRes()
    await processAnalysisHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ processed: 0 })
  })

  it('returns 200 with processed: 1 when job analyzed', async () => {
    mockProcessNext.mockResolvedValueOnce({ processed: 1 })
    const req = makeReq()
    const res = makeRes()
    await processAnalysisHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ processed: 1 })
  })

  it('returns 500 when processNext throws', async () => {
    mockProcessNext.mockRejectedValueOnce(new Error('DB error'))
    const req = makeReq()
    const res = makeRes()
    await processAnalysisHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})
