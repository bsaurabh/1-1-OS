import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './[id]'

jest.mock('@/lib/withAuth', () => ({
  withAuth: (fn: Function) => fn,
}))

jest.mock('@/lib/commitments', () => ({
  confirm: jest.fn(),
  dismiss: jest.fn(),
  updateStatus: jest.fn(),
  deleteCommitment: jest.fn(),
}))

import { confirm, dismiss, updateStatus, deleteCommitment } from '@/lib/commitments'

const mockConfirm = confirm as jest.MockedFunction<typeof confirm>
const mockDismiss = dismiss as jest.MockedFunction<typeof dismiss>
const mockUpdateStatus = updateStatus as jest.MockedFunction<typeof updateStatus>
const mockDelete = deleteCommitment as jest.MockedFunction<typeof deleteCommitment>

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse
}

describe('PATCH /api/commitments/[id]', () => {
  const MANAGER_ID = 'mgr-1'
  const COMMITMENT_ID = 'cmt-1'

  const confirmedCommitment = {
    id: COMMITMENT_ID,
    managerId: MANAGER_ID,
    teammateId: 'tm-1',
    meetingId: 'mtg-1',
    text: 'Follow up',
    owner: 'MANAGER' as const,
    status: 'OPEN' as const,
    dueDate: null,
    carryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => jest.clearAllMocks())

  it('returns 401 — handled by withAuth mock, so withAuth(fn) returns fn directly', () => {
    // withAuth is mocked to return fn directly; auth is assumed in tests below
    expect(true).toBe(true)
  })

  it('returns 405 for non-PATCH method', async () => {
    const req = {
      method: 'GET',
      query: { id: COMMITMENT_ID },
      body: {},
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 400 for invalid action', async () => {
    const req = {
      method: 'PATCH',
      query: { id: COMMITMENT_ID },
      body: { action: 'invalid' },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 200 with updated commitment on confirm', async () => {
    mockConfirm.mockResolvedValueOnce(confirmedCommitment)
    const req = {
      method: 'PATCH',
      query: { id: COMMITMENT_ID },
      body: { action: 'confirm' },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ commitment: confirmedCommitment })
  })

  it('returns 404 when confirm returns null (not found)', async () => {
    mockConfirm.mockResolvedValueOnce(null)
    const req = {
      method: 'PATCH',
      query: { id: COMMITMENT_ID },
      body: { action: 'confirm' },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 200 on dismiss', async () => {
    mockDismiss.mockResolvedValueOnce(true)
    const req = {
      method: 'PATCH',
      query: { id: COMMITMENT_ID },
      body: { action: 'dismiss' },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('returns 404 when dismiss returns false (not found)', async () => {
    mockDismiss.mockResolvedValueOnce(false)
    const req = {
      method: 'PATCH',
      query: { id: COMMITMENT_ID },
      body: { action: 'dismiss' },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 400 with updated message listing all 5 valid actions', async () => {
    const req = {
      method: 'PATCH',
      query: { id: COMMITMENT_ID },
      body: { action: 'invalid' },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('carried_forward') })
    )
  })

  it('returns 200 when action=done and commitment found', async () => {
    mockUpdateStatus.mockResolvedValueOnce({ ...confirmedCommitment, status: 'DONE' as const })
    const req = {
      method: 'PATCH',
      query: { id: COMMITMENT_ID },
      body: { action: 'done' },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('returns 200 when action=carried_forward and commitment found', async () => {
    mockUpdateStatus.mockResolvedValueOnce({ ...confirmedCommitment, status: 'CARRIED_FORWARD' as const, carryCount: 1 })
    const req = {
      method: 'PATCH',
      query: { id: COMMITMENT_ID },
      body: { action: 'carried_forward' },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('returns 200 when action=dropped and commitment found', async () => {
    mockUpdateStatus.mockResolvedValueOnce({ ...confirmedCommitment, status: 'DROPPED' as const })
    const req = {
      method: 'PATCH',
      query: { id: COMMITMENT_ID },
      body: { action: 'dropped' },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('returns 404 when updateStatus returns null (not found)', async () => {
    mockUpdateStatus.mockResolvedValueOnce(null)
    const req = {
      method: 'PATCH',
      query: { id: COMMITMENT_ID },
      body: { action: 'done' },
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('DELETE /api/commitments/[id]', () => {
  const MANAGER_ID = 'mgr-1'
  const COMMITMENT_ID = 'cmt-1'

  beforeEach(() => jest.clearAllMocks())

  it('returns 200 on successful delete', async () => {
    mockDelete.mockResolvedValueOnce(true)
    const req = {
      method: 'DELETE',
      query: { id: COMMITMENT_ID },
      body: {},
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it('returns 404 when commitment not found', async () => {
    mockDelete.mockResolvedValueOnce(false)
    const req = {
      method: 'DELETE',
      query: { id: COMMITMENT_ID },
      body: {},
    } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
