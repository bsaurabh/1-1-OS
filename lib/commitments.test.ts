import { confirm, dismiss, listSuggested, saveSuggested, createCommitment, updateStatus, listOpen, listResolved, deleteCommitment } from './commitments'

jest.mock('./prisma', () => ({
  prisma: {
    commitment: {
      createMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

import { prisma } from './prisma'

const mockCommitment = prisma.commitment as jest.Mocked<typeof prisma.commitment>

const MANAGER_ID = 'mgr-1'
const TEAMMATE_ID = 'tm-1'
const MEETING_ID = 'mtg-1'
const COMMITMENT_ID = 'cmt-1'

const sampleCommitment = {
  id: COMMITMENT_ID,
  managerId: MANAGER_ID,
  teammateId: TEAMMATE_ID,
  meetingId: MEETING_ID,
  text: 'Follow up on design system review',
  owner: 'MANAGER' as const,
  status: 'SUGGESTED' as const,
  dueDate: null,
  carryCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('confirm', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns updated commitment on success', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(sampleCommitment)
    ;(mockCommitment.update as jest.Mock).mockResolvedValue({
      ...sampleCommitment,
      status: 'OPEN',
    })

    const result = await confirm(MANAGER_ID, COMMITMENT_ID)
    expect(result).not.toBeNull()
    expect(mockCommitment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'OPEN' }) })
    )
  })

  it('uses editedText when provided', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(sampleCommitment)
    ;(mockCommitment.update as jest.Mock).mockResolvedValue({
      ...sampleCommitment,
      status: 'OPEN',
      text: 'Updated text',
    })

    await confirm(MANAGER_ID, COMMITMENT_ID, 'Updated text')
    expect(mockCommitment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ text: 'Updated text' }),
      })
    )
  })

  it('returns null if commitment not found', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(null)
    const result = await confirm(MANAGER_ID, COMMITMENT_ID)
    expect(result).toBeNull()
    expect(mockCommitment.update).not.toHaveBeenCalled()
  })

  it('returns null for wrong managerId', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(null)
    const result = await confirm('wrong-manager', COMMITMENT_ID)
    expect(result).toBeNull()
  })
})

describe('dismiss', () => {
  beforeEach(() => jest.clearAllMocks())

  it('deletes commitment and returns true on success', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(sampleCommitment)
    ;(mockCommitment.delete as jest.Mock).mockResolvedValue(sampleCommitment)

    const result = await dismiss(MANAGER_ID, COMMITMENT_ID)
    expect(result).toBe(true)
    expect(mockCommitment.delete).toHaveBeenCalledWith({ where: { id: COMMITMENT_ID } })
  })

  it('returns false if commitment not found', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(null)
    const result = await dismiss(MANAGER_ID, COMMITMENT_ID)
    expect(result).toBe(false)
    expect(mockCommitment.delete).not.toHaveBeenCalled()
  })
})

describe('listSuggested', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns commitments with SUGGESTED status for manager+teammate', async () => {
    ;(mockCommitment.findMany as jest.Mock).mockResolvedValue([sampleCommitment])
    const result = await listSuggested(MANAGER_ID, TEAMMATE_ID)
    expect(result).toHaveLength(1)
    expect(mockCommitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { managerId: MANAGER_ID, teammateId: TEAMMATE_ID, status: 'SUGGESTED' },
      })
    )
  })
})

describe('saveSuggested', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls createMany with correct data', async () => {
    ;(mockCommitment.createMany as jest.Mock).mockResolvedValue({ count: 2 })
    await saveSuggested(MANAGER_ID, TEAMMATE_ID, MEETING_ID, [
      { text: 'Action 1', owner: 'MANAGER' },
      { text: 'Action 2', owner: 'TEAMMATE' },
    ])
    expect(mockCommitment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ text: 'Action 1', owner: 'MANAGER', status: 'SUGGESTED' }),
          expect.objectContaining({ text: 'Action 2', owner: 'TEAMMATE', status: 'SUGGESTED' }),
        ]),
      })
    )
  })

  it('does nothing when suggestions array is empty', async () => {
    await saveSuggested(MANAGER_ID, TEAMMATE_ID, MEETING_ID, [])
    expect(mockCommitment.createMany).not.toHaveBeenCalled()
  })
})

// ─── Unit 5 additions ──────────────────────────────────────────────────────────

const openCommitment = {
  ...sampleCommitment,
  status: 'OPEN' as const,
  carryCount: 0,
}

describe('createCommitment', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates commitment and returns it when no duplicate exists', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockCommitment.create as jest.Mock).mockResolvedValue({ ...openCommitment, id: 'new-1' })

    const result = await createCommitment(MANAGER_ID, TEAMMATE_ID, 'New action', 'MANAGER')
    expect('commitment' in result).toBe(true)
    expect(mockCommitment.create).toHaveBeenCalled()
  })

  it('returns duplicate info when matching open commitment exists', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-1' })

    const result = await createCommitment(MANAGER_ID, TEAMMATE_ID, 'Follow up on design system review', 'MANAGER')
    expect('duplicate' in result).toBe(true)
    if ('duplicate' in result) {
      expect(result.existingId).toBe('existing-1')
    }
    expect(mockCommitment.create).not.toHaveBeenCalled()
  })
})

describe('updateStatus', () => {
  beforeEach(() => jest.clearAllMocks())

  it('updates status to DONE', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(openCommitment)
    ;(mockCommitment.update as jest.Mock).mockResolvedValue({ ...openCommitment, status: 'DONE' })

    const result = await updateStatus(MANAGER_ID, COMMITMENT_ID, 'done')
    expect(result?.status).toBe('DONE')
    expect(mockCommitment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DONE' }) })
    )
  })

  it('increments carryCount when action is carried_forward', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(openCommitment)
    ;(mockCommitment.update as jest.Mock).mockResolvedValue({ ...openCommitment, status: 'CARRIED_FORWARD', carryCount: 1 })

    await updateStatus(MANAGER_ID, COMMITMENT_ID, 'carried_forward')
    expect(mockCommitment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ carryCount: { increment: 1 } }),
      })
    )
  })

  it('updates status to DROPPED', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(openCommitment)
    ;(mockCommitment.update as jest.Mock).mockResolvedValue({ ...openCommitment, status: 'DROPPED' })

    const result = await updateStatus(MANAGER_ID, COMMITMENT_ID, 'dropped')
    expect(result?.status).toBe('DROPPED')
  })

  it('returns null when commitment not found or not in valid status', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await updateStatus(MANAGER_ID, COMMITMENT_ID, 'done')
    expect(result).toBeNull()
    expect(mockCommitment.update).not.toHaveBeenCalled()
  })
})

describe('listOpen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns OPEN and CARRIED_FORWARD commitments for manager+teammate', async () => {
    ;(mockCommitment.findMany as jest.Mock).mockResolvedValue([openCommitment])

    const result = await listOpen(MANAGER_ID, TEAMMATE_ID)
    expect(result).toHaveLength(1)
    expect(mockCommitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          managerId: MANAGER_ID,
          teammateId: TEAMMATE_ID,
          status: { in: ['OPEN', 'CARRIED_FORWARD'] },
        }),
      })
    )
  })
})

describe('listResolved', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns DONE and DROPPED commitments capped at 20', async () => {
    ;(mockCommitment.findMany as jest.Mock).mockResolvedValue([])

    await listResolved(MANAGER_ID, TEAMMATE_ID)
    expect(mockCommitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['DONE', 'DROPPED'] } }),
        take: 20,
      })
    )
  })
})

describe('deleteCommitment', () => {
  beforeEach(() => jest.clearAllMocks())

  it('deletes commitment and returns true when found', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue({ id: COMMITMENT_ID })
    ;(mockCommitment.delete as jest.Mock).mockResolvedValue(openCommitment)

    const result = await deleteCommitment(MANAGER_ID, COMMITMENT_ID)
    expect(result).toBe(true)
    expect(mockCommitment.delete).toHaveBeenCalledWith({ where: { id: COMMITMENT_ID } })
  })

  it('returns false when commitment not found', async () => {
    ;(mockCommitment.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await deleteCommitment(MANAGER_ID, COMMITMENT_ID)
    expect(result).toBe(false)
    expect(mockCommitment.delete).not.toHaveBeenCalled()
  })
})
