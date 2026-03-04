import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './paste'

jest.mock('@/lib/withAuth', () => ({
  withAuth: (fn: Function) => fn,
}))

jest.mock('@/lib/meetings', () => ({
  ingestPaste: jest.fn(),
}))

import { ingestPaste } from '@/lib/meetings'

const mockIngestPaste = ingestPaste as jest.MockedFunction<typeof ingestPaste>

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse
  return res
}

describe('POST /api/meetings/[teammateId]/paste', () => {
  const MANAGER_ID = 'mgr-1'
  const TEAMMATE_ID = 'tm-1'

  beforeEach(() => jest.clearAllMocks())

  it('returns 405 for non-POST method', async () => {
    const req = { method: 'GET', query: { teammateId: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 400 if text is too short', async () => {
    const req = {
      method: 'POST',
      query: { teammateId: TEAMMATE_ID },
      body: { text: 'short' },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 404 if teammate not found', async () => {
    mockIngestPaste.mockRejectedValueOnce(new Error('Teammate not found'))
    const req = {
      method: 'POST',
      query: { teammateId: TEAMMATE_ID },
      body: { text: 'A'.repeat(60) },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 200 with meetingId on success', async () => {
    mockIngestPaste.mockResolvedValueOnce('mtg-abc')
    const req = {
      method: 'POST',
      query: { teammateId: TEAMMATE_ID },
      body: { text: 'A'.repeat(60) },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ meetingId: 'mtg-abc' })
  })
})
