import { prisma } from './prisma'
import type { ProfileFields } from '@/handlers/interviewAIHandler'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeammateListItem {
  id:                 string
  name:               string
  role:               string
  profileCompleteness: number
  createdAt:          string
}

export interface TeammateDetail {
  id:                 string
  managerId:          string
  name:               string
  role:               string
  profile:            ProfileFields | null
  profileCompleteness: number
  createdAt:          string
  updatedAt:          string
}

// ─── Completeness helper ──────────────────────────────────────────────────────

/**
 * Count how many of the 8 profile fields are populated.
 * role is always 1 (required at creation). 7 JSONB keys counted if non-empty.
 * _rawAnswers key is ignored.
 */
export function countPopulatedFields(
  role: string,
  profile: ProfileFields | null,
): number {
  let count = role && role.trim().length > 0 ? 1 : 0
  if (!profile) return count

  const keys: (keyof ProfileFields)[] = [
    'strengths',
    'growthAreas',
    'aspirations',
    'kpis',
    'behavioralTendencies',
    'feedbackStyle',
    'motivationDrivers',
  ]
  for (const key of keys) {
    const val = profile[key] as string | undefined
    if (val && val.trim().length > 0) count++
  }
  return count
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function createTeammate(
  managerId: string,
  name: string,
  role: string,
): Promise<{ id: string; name: string; role: string; createdAt: string }> {
  const teammate = await prisma.teammate.create({
    data: { managerId, name, role, profile: undefined },
  })
  return {
    id:        teammate.id,
    name:      teammate.name,
    role:      teammate.role,
    createdAt: teammate.createdAt.toISOString(),
  }
}

export async function listTeammates(managerId: string): Promise<TeammateListItem[]> {
  const teammates = await prisma.teammate.findMany({
    where:   { managerId },
    orderBy: { name: 'asc' },
  })

  return teammates.map(t => ({
    id:                  t.id,
    name:                t.name,
    role:                t.role,
    profileCompleteness: countPopulatedFields(t.role, t.profile as ProfileFields | null),
    createdAt:           t.createdAt.toISOString(),
  }))
}

export async function getTeammate(
  managerId: string,
  teammateId: string,
): Promise<TeammateDetail | null> {
  const t = await prisma.teammate.findFirst({
    where: { id: teammateId, managerId },
  })
  if (!t) return null

  return {
    id:                  t.id,
    managerId:           t.managerId,
    name:                t.name,
    role:                t.role,
    profile:             t.profile as ProfileFields | null,
    profileCompleteness: countPopulatedFields(t.role, t.profile as ProfileFields | null),
    createdAt:           t.createdAt.toISOString(),
    updatedAt:           t.updatedAt.toISOString(),
  }
}

export async function updateTeammate(
  managerId: string,
  teammateId: string,
  updates: { name?: string; role?: string; profile?: Partial<ProfileFields> },
): Promise<TeammateDetail | null> {
  const existing = await prisma.teammate.findFirst({
    where: { id: teammateId, managerId },
  })
  if (!existing) return null

  const updateData: {
    name?: string
    role?: string
    profile?: Record<string, unknown>
  } = {}

  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.role !== undefined) updateData.role = updates.role
  if (updates.profile !== undefined) {
    const existingProfile = (existing.profile as ProfileFields | null) ?? {}
    updateData.profile = { ...existingProfile, ...updates.profile }
  }

  const t = await prisma.teammate.update({
    where: { id: teammateId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: updateData as any,
  })

  return {
    id:                  t.id,
    managerId:           t.managerId,
    name:                t.name,
    role:                t.role,
    profile:             t.profile as ProfileFields | null,
    profileCompleteness: countPopulatedFields(t.role, t.profile as ProfileFields | null),
    createdAt:           t.createdAt.toISOString(),
    updatedAt:           t.updatedAt.toISOString(),
  }
}

export async function deleteTeammate(
  managerId: string,
  teammateId: string,
): Promise<boolean> {
  const existing = await prisma.teammate.findFirst({
    where: { id: teammateId, managerId },
  })
  if (!existing) return false

  await prisma.teammate.delete({ where: { id: teammateId } })
  return true
}
