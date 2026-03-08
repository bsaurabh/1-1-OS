import { prisma } from './prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CritiqueListItem {
  id: string
  featureName: string
  status: string
  stage: string
  clarityScore: number | null
  createdAt: string
}

export interface CritiqueDetail {
  id: string
  featureName: string
  userType: string
  featureGoal: string
  successMetric: string
  constraints: string | null
  stage: string
  focusAreas: string[]
  imageUrls: string[]
  figmaUrl: string | null
  status: string
  result: unknown
  createdAt: string
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listCritiques(managerId: string): Promise<CritiqueListItem[]> {
  const rows = await prisma.designCritique.findMany({
    where: { managerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      featureName: true,
      status: true,
      stage: true,
      result: true,
      createdAt: true,
    },
  })

  return rows.map((r) => {
    const result = r.result as { executiveSummary?: { clarityScore?: number } } | null
    return {
      id: r.id,
      featureName: r.featureName,
      status: r.status,
      stage: r.stage,
      clarityScore: result?.executiveSummary?.clarityScore ?? null,
      createdAt: r.createdAt.toISOString(),
    }
  })
}

export async function getCritique(managerId: string, id: string): Promise<CritiqueDetail | null> {
  const row = await prisma.designCritique.findFirst({
    where: { id, managerId },
  })

  if (!row) return null

  return {
    id: row.id,
    featureName: row.featureName,
    userType: row.userType,
    featureGoal: row.featureGoal,
    successMetric: row.successMetric,
    constraints: row.constraints,
    stage: row.stage,
    focusAreas: row.focusAreas,
    imageUrls: row.imageUrls,
    figmaUrl: row.figmaUrl,
    status: row.status,
    result: row.result,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function createCritique(managerId: string, data: {
  featureName: string
  userType: string
  featureGoal: string
  successMetric: string
  constraints?: string
  stage: 'EXPLORATORY' | 'FINAL_POLISH'
  focusAreas: string[]
  imageUrls: string[]
  figmaUrl?: string
}): Promise<string> {
  const row = await prisma.designCritique.create({
    data: {
      managerId,
      featureName: data.featureName,
      userType: data.userType,
      featureGoal: data.featureGoal,
      successMetric: data.successMetric,
      constraints: data.constraints ?? null,
      stage: data.stage,
      focusAreas: data.focusAreas,
      imageUrls: data.imageUrls,
      figmaUrl: data.figmaUrl ?? null,
    },
    select: { id: true },
  })

  return row.id
}

export async function updateCritiqueStatus(
  id: string,
  status: 'ANALYZING' | 'COMPLETE' | 'FAILED',
  result?: unknown
): Promise<void> {
  await prisma.designCritique.update({
    where: { id },
    data: {
      status,
      ...(result !== undefined ? { result: result as never } : {}),
    },
  })
}
