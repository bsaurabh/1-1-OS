import {
  countPopulatedFields,
  createTeammate,
  listTeammates,
  getTeammate,
  updateTeammate,
  deleteTeammate,
} from './teammates'
import type { ProfileFields } from '@/handlers/interviewAIHandler'

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

jest.mock('./prisma', () => ({
  prisma: {
    teammate: {
      create:    jest.fn(),
      findMany:  jest.fn(),
      findFirst: jest.fn(),
      update:    jest.fn(),
      delete:    jest.fn(),
    },
  },
}))

import { prisma } from './prisma'

// Typed alias for the mocked teammate model methods
const pt = prisma.teammate as jest.Mocked<typeof prisma.teammate>

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2024-01-15T00:00:00.000Z')

function makeDbTeammate(overrides: Record<string, unknown> = {}) {
  return {
    id:        'tm-1',
    managerId: 'mgr-1',
    name:      'Alice',
    role:      'Designer',
    profile:   null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

// ─── countPopulatedFields ─────────────────────────────────────────────────────

describe('countPopulatedFields', () => {
  it('returns 1 when role is set and profile is null', () => {
    expect(countPopulatedFields('Designer', null)).toBe(1)
  })

  it('returns 0 when role is empty string', () => {
    expect(countPopulatedFields('', null)).toBe(0)
  })

  it('returns 0 when role is whitespace-only', () => {
    expect(countPopulatedFields('   ', null)).toBe(0)
  })

  it('returns 8 when role and all 7 profile fields are populated', () => {
    const profile: ProfileFields = {
      strengths:            'Systems thinking',
      growthAreas:          'Communication',
      aspirations:          'Lead design team',
      kpis:                 'NPS, velocity',
      behavioralTendencies: 'Introvert',
      feedbackStyle:        'Direct',
      motivationDrivers:    'Craft and impact',
    }
    expect(countPopulatedFields('Designer', profile)).toBe(8)
  })

  it('ignores _rawAnswers key', () => {
    const profile = {
      _rawAnswers: [{ questionIndex: 1, area: 'strengths' as any, question: 'Q?', answer: 'A' }],
    } as ProfileFields
    expect(countPopulatedFields('Designer', profile)).toBe(1)
  })

  it('does not count whitespace-only profile field values', () => {
    const profile: ProfileFields = { strengths: '   ', growthAreas: 'Something useful' }
    // role(1) + growthAreas(1) = 2
    expect(countPopulatedFields('Designer', profile)).toBe(2)
  })

  it('counts only populated fields among the 7 JSONB keys', () => {
    const profile: ProfileFields = {
      strengths: 'A',
      growthAreas: 'B',
    }
    // role(1) + strengths(1) + growthAreas(1) = 3
    expect(countPopulatedFields('PM', profile)).toBe(3)
  })
})

// ─── createTeammate ───────────────────────────────────────────────────────────

describe('createTeammate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls prisma.teammate.create with correct data', async () => {
    pt.create.mockResolvedValue(makeDbTeammate())

    await createTeammate('mgr-1', 'Alice', 'Designer')

    expect(pt.create).toHaveBeenCalledWith({
      data: { managerId: 'mgr-1', name: 'Alice', role: 'Designer', profile: undefined },
    })
  })

  it('returns mapped teammate with ISO createdAt', async () => {
    pt.create.mockResolvedValue(makeDbTeammate())

    const result = await createTeammate('mgr-1', 'Alice', 'Designer')

    expect(result.id).toBe('tm-1')
    expect(result.name).toBe('Alice')
    expect(result.role).toBe('Designer')
    expect(result.createdAt).toBe(NOW.toISOString())
  })
})

// ─── listTeammates ────────────────────────────────────────────────────────────

describe('listTeammates', () => {
  beforeEach(() => jest.clearAllMocks())

  it('queries by managerId ordered by name', async () => {
    pt.findMany.mockResolvedValue([])

    await listTeammates('mgr-1')

    expect(pt.findMany).toHaveBeenCalledWith({
      where:   { managerId: 'mgr-1' },
      orderBy: { name: 'asc' },
    })
  })

  it('returns mapped list with profileCompleteness', async () => {
    pt.findMany.mockResolvedValue([makeDbTeammate()])

    const result = await listTeammates('mgr-1')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tm-1')
    expect(result[0].profileCompleteness).toBe(1) // role only, no profile
  })

  it('calculates completeness when profile has fields', async () => {
    const profile: ProfileFields = { strengths: 'Great', growthAreas: 'Comms' }
    pt.findMany.mockResolvedValue([makeDbTeammate({ profile })])

    const result = await listTeammates('mgr-1')

    expect(result[0].profileCompleteness).toBe(3) // role + 2 profile fields
  })

  it('returns empty array when no teammates', async () => {
    pt.findMany.mockResolvedValue([])
    expect(await listTeammates('mgr-1')).toEqual([])
  })
})

// ─── getTeammate ──────────────────────────────────────────────────────────────

describe('getTeammate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns null when teammate not found', async () => {
    pt.findFirst.mockResolvedValue(null)

    expect(await getTeammate('mgr-1', 'tm-1')).toBeNull()
  })

  it('queries with both managerId and id for ownership check', async () => {
    pt.findFirst.mockResolvedValue(makeDbTeammate())

    await getTeammate('mgr-1', 'tm-1')

    expect(pt.findFirst).toHaveBeenCalledWith({
      where: { id: 'tm-1', managerId: 'mgr-1' },
    })
  })

  it('returns full TeammateDetail when found', async () => {
    pt.findFirst.mockResolvedValue(makeDbTeammate())

    const result = await getTeammate('mgr-1', 'tm-1')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('tm-1')
    expect(result!.managerId).toBe('mgr-1')
    expect(result!.profileCompleteness).toBe(1)
    expect(result!.createdAt).toBe(NOW.toISOString())
    expect(result!.updatedAt).toBe(NOW.toISOString())
  })
})

// ─── updateTeammate ───────────────────────────────────────────────────────────

describe('updateTeammate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns null when teammate not found', async () => {
    pt.findFirst.mockResolvedValue(null)

    expect(await updateTeammate('mgr-1', 'tm-1', { name: 'Bob' })).toBeNull()
    expect(pt.update).not.toHaveBeenCalled()
  })

  it('updates name only when name is provided', async () => {
    pt.findFirst.mockResolvedValue(makeDbTeammate())
    pt.update.mockResolvedValue(makeDbTeammate({ name: 'Bob' }))

    const result = await updateTeammate('mgr-1', 'tm-1', { name: 'Bob' })

    expect(pt.update).toHaveBeenCalledWith({
      where: { id: 'tm-1' },
      data:  { name: 'Bob' },
    })
    expect(result!.name).toBe('Bob')
  })

  it('merges profile JSONB — existing fields not overwritten', async () => {
    const existingProfile: ProfileFields = { strengths: 'existing-strength' }
    pt.findFirst.mockResolvedValue(makeDbTeammate({ profile: existingProfile }))
    pt.update.mockResolvedValue(makeDbTeammate({
      profile: { strengths: 'existing-strength', growthAreas: 'new-growth' },
    }))

    await updateTeammate('mgr-1', 'tm-1', { profile: { growthAreas: 'new-growth' } })

    expect(pt.update).toHaveBeenCalledWith({
      where: { id: 'tm-1' },
      data:  { profile: { strengths: 'existing-strength', growthAreas: 'new-growth' } },
    })
  })

  it('treats null existing profile as empty object when merging', async () => {
    pt.findFirst.mockResolvedValue(makeDbTeammate({ profile: null }))
    pt.update.mockResolvedValue(makeDbTeammate({ profile: { strengths: 'new' } }))

    await updateTeammate('mgr-1', 'tm-1', { profile: { strengths: 'new' } })

    expect(pt.update).toHaveBeenCalledWith({
      where: { id: 'tm-1' },
      data:  { profile: { strengths: 'new' } },
    })
  })
})

// ─── deleteTeammate ───────────────────────────────────────────────────────────

describe('deleteTeammate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns false when teammate not found', async () => {
    pt.findFirst.mockResolvedValue(null)

    expect(await deleteTeammate('mgr-1', 'tm-1')).toBe(false)
    expect(pt.delete).not.toHaveBeenCalled()
  })

  it('deletes by id and returns true when found', async () => {
    pt.findFirst.mockResolvedValue(makeDbTeammate())
    pt.delete.mockResolvedValue(makeDbTeammate())

    const result = await deleteTeammate('mgr-1', 'tm-1')

    expect(pt.delete).toHaveBeenCalledWith({ where: { id: 'tm-1' } })
    expect(result).toBe(true)
  })
})
