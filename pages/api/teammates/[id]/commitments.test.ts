import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './commitments'

jest.mock('@/lib/withAuth', () => ({
  withAuth: (fn: Function) => fn,
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    teammate: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/commitments', () => ({
  listOpen: jest.fn(),
  listResolved: jest.fn(),
  createCommitment: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { listOpen, listResolved, createCommitment } from '@/lib/commitments'

const mockTeammate = prisma.teammate as jest.Mocked<typeof prisma.teammate>
const mockListOpen = listOpen as jest.MockedFunction<typeof listOpen>
const mockListResolved = listResolved as jest.MockedFunction<typeof listResolved>
const mockCreate = createCommitment as jest.MockedFunction<typeof createCommitment>

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse
}

const MANAGER_ID = 'mgr-1'
const TEAMMATE_ID = 'tm-1'

const sampleCommitment = {
  id: 'cmt-1',
  managerId: MANAGER_ID,
  teammateId: TEAMMATE_ID,
  meetingId: null,
  text: 'Follow up',
  owner: 'MANAGER' as const,
  status: 'OPEN' as const,
  dueDate: null,
  carryCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/teammates/[id]/commitments', () => {
  it('returns 405 for non-GET/POST method', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    const req = { method: 'DELETE', query: { id: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 404 when teammate not found', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue(null)
    const req = { method: 'GET', query: { id: TEAMMATE_ID, status: 'open' }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 400 when status param is missing', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    const req = { method: 'GET', query: { id: TEAMMATE_ID }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 200 with open commitments', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockListOpen.mockResolvedValue([sampleCommitment])
    const req = { method: 'GET', query: { id: TEAMMATE_ID, status: 'open' }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ commitments: [sampleCommitment] })
  })

  it('returns 200 with resolved commitments', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockListResolved.mockResolvedValue([])
    const req = { method: 'GET', query: { id: TEAMMATE_ID, status: 'resolved' }, body: {} } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ commitments: [] })
  })
})

describe('POST /api/teammates/[id]/commitments', () => {
  it('returns 400 when text is missing', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    const req = { method: 'POST', query: { id: TEAMMATE_ID }, body: { owner: 'MANAGER' } } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 400 when owner is invalid', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    const req = { method: 'POST', query: { id: TEAMMATE_ID }, body: { text: 'Do thing', owner: 'BOTH' } } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 201 when commitment created successfully', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockCreate.mockResolvedValue({ commitment: sampleCommitment })
    const req = { method: 'POST', query: { id: TEAMMATE_ID }, body: { text: 'Follow up', owner: 'MANAGER' } } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ commitment: sampleCommitment })
  })

  it('returns 409 when duplicate commitment detected', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
    mockCreate.mockResolvedValue({ duplicate: true, existingId: 'cmt-existing' })
    const req = { method: 'POST', query: { id: TEAMMATE_ID }, body: { text: 'Follow up', owner: 'MANAGER' } } as unknown as NextApiRequest
    const res = makeRes()
    await (handler as Function)(req, res, MANAGER_ID)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ duplicate: true, existingId: 'cmt-existing' })
  })
})
