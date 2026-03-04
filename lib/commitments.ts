import { prisma } from '@/lib/prisma'
import type { Commitment } from '@prisma/client'

// ─── Unit 5: Tracker & Timeline additions ─────────────────────────────────────

export async function createCommitment(
  managerId: string,
  teammateId: string,
  text: string,
  owner: 'MANAGER' | 'TEAMMATE',
  dueDate?: string | null
): Promise<{ commitment: Commitment } | { duplicate: true; existingId: string }> {
  // Duplicate check: case-insensitive text match on open commitments (BR-5.04)
  const existing = await prisma.commitment.findFirst({
    where: {
      managerId,
      teammateId,
      status: { in: ['OPEN', 'CARRIED_FORWARD'] },
      text: { equals: text, mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (existing) return { duplicate: true, existingId: existing.id }

  const commitment = await prisma.commitment.create({
    data: {
      managerId,
      teammateId,
      text,
      owner,
      status: 'OPEN',
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  })
  return { commitment }
}

export async function updateStatus(
  managerId: string,
  id: string,
  action: 'done' | 'carried_forward' | 'dropped'
): Promise<Commitment | null> {
  const commitment = await prisma.commitment.findFirst({
    where: { id, managerId, status: { in: ['OPEN', 'CARRIED_FORWARD'] } },
  })
  if (!commitment) return null

  const statusMap = {
    done: 'DONE',
    carried_forward: 'CARRIED_FORWARD',
    dropped: 'DROPPED',
  } as const

  return prisma.commitment.update({
    where: { id },
    data: {
      status: statusMap[action],
      ...(action === 'carried_forward' ? { carryCount: { increment: 1 } } : {}),
    },
  })
}

export async function listOpen(
  managerId: string,
  teammateId: string
): Promise<Commitment[]> {
  return prisma.commitment.findMany({
    where: { managerId, teammateId, status: { in: ['OPEN', 'CARRIED_FORWARD'] } },
    orderBy: { createdAt: 'asc' },
  })
}

export async function listResolved(
  managerId: string,
  teammateId: string
): Promise<Commitment[]> {
  return prisma.commitment.findMany({
    where: { managerId, teammateId, status: { in: ['DONE', 'DROPPED'] } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })
}

export async function deleteCommitment(
  managerId: string,
  id: string
): Promise<boolean> {
  const commitment = await prisma.commitment.findFirst({
    where: { id, managerId },
    select: { id: true },
  })
  if (!commitment) return false

  await prisma.commitment.delete({ where: { id } })
  return true
}

export async function saveSuggested(
  managerId: string,
  teammateId: string,
  meetingId: string,
  suggestions: Array<{ text: string; owner: 'MANAGER' | 'TEAMMATE' }>
): Promise<void> {
  if (suggestions.length === 0) return
  await prisma.commitment.createMany({
    data: suggestions.map((s) => ({
      managerId,
      teammateId,
      meetingId,
      text: s.text,
      owner: s.owner,
      status: 'SUGGESTED',
    })),
  })
}

export async function confirm(
  managerId: string,
  commitmentId: string,
  editedText?: string
): Promise<Commitment | null> {
  const commitment = await prisma.commitment.findFirst({
    where: { id: commitmentId, managerId, status: 'SUGGESTED' },
  })
  if (!commitment) return null

  return prisma.commitment.update({
    where: { id: commitmentId },
    data: {
      status: 'OPEN',
      text: editedText ?? commitment.text,
    },
  })
}

export async function dismiss(
  managerId: string,
  commitmentId: string
): Promise<boolean> {
  const commitment = await prisma.commitment.findFirst({
    where: { id: commitmentId, managerId, status: 'SUGGESTED' },
    select: { id: true },
  })
  if (!commitment) return false

  await prisma.commitment.delete({ where: { id: commitmentId } })
  return true
}

export async function listSuggested(
  managerId: string,
  teammateId: string
): Promise<Commitment[]> {
  return prisma.commitment.findMany({
    where: { managerId, teammateId, status: 'SUGGESTED' },
    orderBy: { createdAt: 'asc' },
  })
}
