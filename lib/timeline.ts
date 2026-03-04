import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

// ─── Constants ─────────────────────────────────────────────────────────────────

export const SUMMARY_MODEL = 'claude-haiku-4-5-20251001'
export const MAX_MEETINGS_FOR_SUMMARY = 10

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TimelineMeetingEntry {
  id: string
  summary: string | null
  tags: string[]
  tone: string | null
  status: string
  createdAt: string
}

export interface GrowthSummary {
  teammateName: string
  generatedAt: string
  narrative: string
  keyThemes: string[]
  growthSignals: string[]
  coachingGaps: string[]
}

export class EmptyHistoryError extends Error {
  constructor() {
    super('No completed meetings available for growth summary')
    this.name = 'EmptyHistoryError'
  }
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

async function callClaudeWithRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 1000
): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    if (retries > 0 && status && [429, 529, 500, 502, 503].includes(status)) {
      await new Promise((r) => setTimeout(r, delayMs))
      return callClaudeWithRetry(fn, retries - 1, delayMs)
    }
    throw err
  }
}

// ─── Exported functions ────────────────────────────────────────────────────────

export async function listTimeline(
  managerId: string,
  teammateId: string
): Promise<TimelineMeetingEntry[]> {
  const meetings = await prisma.meeting.findMany({
    where: { managerId, teammateId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, summary: true, tags: true, tone: true, status: true, createdAt: true },
  })

  return meetings.map((m) => ({
    id: m.id,
    summary: m.summary,
    tags: m.tags as string[],
    tone: m.tone,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
  }))
}

export function buildGrowthSummaryPrompt(
  teammate: { name: string; profile: unknown },
  meetings: Array<{ summary: string | null; tags: unknown; tone: string | null; createdAt: Date }>
): string {
  const meetingLines = meetings
    .map((m, i) => {
      const date = m.createdAt.toISOString().slice(0, 10)
      const tags = Array.isArray(m.tags) ? (m.tags as string[]).join(', ') : ''
      return `Meeting ${i + 1} (${date}):
  Summary: ${m.summary ?? 'N/A'}
  Tags: ${tags || 'none'}
  Tone: ${m.tone ?? 'N/A'}`
    })
    .join('\n\n')

  return `You are a coaching assistant helping a design manager track their teammate's growth.

Teammate: ${teammate.name}
${teammate.profile ? `Profile context: ${JSON.stringify(teammate.profile)}` : ''}

Here are their recent 1:1 meetings in chronological order:

${meetingLines}

Based on these meetings, produce a JSON growth summary with exactly this structure:
{
  "narrative": "<2-3 sentence paragraph summarizing overall growth trajectory>",
  "keyThemes": ["<theme 1>", "<theme 2>", "<theme 3>"],
  "growthSignals": ["<positive signal 1>", "<positive signal 2>"],
  "coachingGaps": ["<area needing attention 1>", "<area needing attention 2>"]
}

Respond with JSON only. No markdown, no explanation.`
}

export function parseGrowthSummaryResponse(text: string): Partial<GrowthSummary> {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const raw = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    return {
      narrative: typeof raw.narrative === 'string' ? raw.narrative : undefined,
      keyThemes: Array.isArray(raw.keyThemes) ? raw.keyThemes : undefined,
      growthSignals: Array.isArray(raw.growthSignals) ? raw.growthSignals : undefined,
      coachingGaps: Array.isArray(raw.coachingGaps) ? raw.coachingGaps : undefined,
    }
  } catch {
    return {}
  }
}

export async function generateGrowthSummary(
  managerId: string,
  teammateId: string,
  client?: Anthropic
): Promise<GrowthSummary | null> {
  // P-5.01: Parallel DB pre-fetch
  const [teammate, meetings] = await Promise.all([
    prisma.teammate.findFirst({
      where: { id: teammateId, managerId },
      select: { name: true, profile: true },
    }),
    prisma.meeting.findMany({
      where: { managerId, teammateId, status: 'ANALYSIS_COMPLETE' },
      orderBy: { createdAt: 'asc' },
      take: MAX_MEETINGS_FOR_SUMMARY,
      select: { summary: true, tags: true, tone: true, createdAt: true },
    }),
  ])

  if (!teammate) throw new Error('Teammate not found')
  if (meetings.length === 0) throw new EmptyHistoryError()

  // P-5.02: Graceful degradation — Claude failure returns null
  try {
    const anthropic = client ?? new Anthropic()
    const prompt = buildGrowthSummaryPrompt(teammate, meetings)

    const message = await callClaudeWithRetry(() =>
      anthropic.messages.create({
        model: SUMMARY_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      })
    )

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = parseGrowthSummaryResponse(text)

    if (!parsed.narrative || !parsed.keyThemes || !parsed.growthSignals || !parsed.coachingGaps) {
      console.error('[growthSummary] incomplete response fields')
      return null
    }

    return {
      teammateName: teammate.name,
      generatedAt: new Date().toISOString(),
      narrative: parsed.narrative,
      keyThemes: parsed.keyThemes,
      growthSignals: parsed.growthSignals,
      coachingGaps: parsed.coachingGaps,
    }
  } catch (err) {
    // P-5.02: Log failure but return null — caller wraps as { summary: null }
    console.error('[growthSummary] generation failed:', err)
    return null
  }
}
