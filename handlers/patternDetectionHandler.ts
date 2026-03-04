import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

// ─── Constants ────────────────────────────────────────────────────────────────

export const PATTERN_MODEL = 'claude-haiku-4-5-20251001'
export const MAX_PATTERNS_PER_TEAMMATE = 10

export const VALID_SEVERITIES = ['INFORMATIONAL', 'WATCH', 'ACTION_REQUIRED'] as const
type PatternSeverity = typeof VALID_SEVERITIES[number]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetectedPattern {
  description: string
  severity: PatternSeverity
  evidence: {
    meetingIds: string[]
    dates: string[]
    tags: string[]
  }
}

export class PatternParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PatternParseError'
  }
}

// ─── Singleton client ─────────────────────────────────────────────────────────

let _defaultClient: Anthropic | null = null

function getClient(client?: Anthropic): Anthropic {
  if (client) return client
  if (!_defaultClient) {
    _defaultClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _defaultClient
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function callClaudeWithRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 1000): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (retries > 0 && isTransientError(err)) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      return callClaudeWithRetry(fn, retries - 1, delayMs)
    }
    throw err
  }
}

function isTransientError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return err.status >= 500 || err.status === 529 || err.status === 429
  }
  return err instanceof Error && err.message.toLowerCase().includes('fetch')
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildPatternPrompt(
  meetingSummaries: string[],
  tagFrequencies: Record<string, number>,
  teammateName: string
): string {
  const topTags = Object.entries(tagFrequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => `${tag} (${count}x)`)
    .join(', ')

  const summariesText = meetingSummaries
    .map((s, i) => `Meeting ${i + 1}: ${s}`)
    .join('\n\n')

  return [
    `You are an AI assistant helping a design manager identify recurring behavioral patterns in their 1:1s.`,
    ``,
    `Teammate: ${teammateName}`,
    ``,
    `Recent meeting summaries (chronological):`,
    `"""`,
    summariesText,
    `"""`,
    ``,
    `Recurring tags across meetings: ${topTags || 'none'}`,
    ``,
    `Identify 0–5 recurring patterns. A pattern must appear in at least 2 meetings.`,
    `Return a JSON array. Each item must have:`,
    `  "description": string — one clear sentence describing the pattern`,
    `  "severity": one of "INFORMATIONAL" | "WATCH" | "ACTION_REQUIRED"`,
    `  "evidence": { "meetingIds": [], "dates": [], "tags": [] }`,
    ``,
    `Severity guide:`,
    `  INFORMATIONAL — trend worth tracking, no immediate action`,
    `  WATCH — pattern emerging, may need coaching attention`,
    `  ACTION_REQUIRED — recurring issue requiring direct coaching intervention`,
    ``,
    `Rules:`,
    `- Return ONLY a valid JSON array. No prose, no markdown, no explanation.`,
    `- Return [] if no clear recurring patterns are found.`,
    `- Each pattern must be supported by evidence from at least 2 meetings.`,
  ].join('\n')
}

// ─── Response parser ──────────────────────────────────────────────────────────

export function parsePatternResponse(text: string): DetectedPattern[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new PatternParseError(`Failed to parse pattern response: ${text.slice(0, 200)}`)
    try {
      parsed = JSON.parse(match[0])
    } catch {
      throw new PatternParseError(`Failed to parse extracted JSON: ${text.slice(0, 200)}`)
    }
  }

  if (!Array.isArray(parsed)) {
    throw new PatternParseError('Pattern response is not a JSON array')
  }

  return parsed
    .filter((item): item is DetectedPattern => {
      if (!item || typeof item !== 'object') return false
      const obj = item as Record<string, unknown>
      if (typeof obj.description !== 'string' || !obj.description.trim()) return false
      if (!(VALID_SEVERITIES as readonly string[]).includes(obj.severity as string)) return false
      if (!obj.evidence || typeof obj.evidence !== 'object') return false
      const ev = obj.evidence as Record<string, unknown>
      if (!Array.isArray(ev.tags)) return false
      return true
    })
    .map((item) => ({
      description: item.description,
      severity: item.severity,
      evidence: {
        meetingIds: Array.isArray(item.evidence.meetingIds) ? item.evidence.meetingIds : [],
        dates: Array.isArray(item.evidence.dates) ? item.evidence.dates : [],
        tags: item.evidence.tags,
      },
    }))
}

// ─── Upsert helper (dedup + cap) ──────────────────────────────────────────────

async function upsertPattern(teammateId: string, detected: DetectedPattern): Promise<void> {
  // Dedup: same severity + ≥2 overlapping tags (BR-4.04)
  const existing = await prisma.pattern.findMany({ where: { teammateId } })

  const duplicate = existing.find((p) => {
    if (p.severity !== detected.severity) return false
    const existingTags: string[] = ((p.evidence as Record<string, unknown>)?.tags as string[]) ?? []
    const overlapCount = detected.evidence.tags.filter((t) => existingTags.includes(t)).length
    return overlapCount >= 2
  })

  if (duplicate) {
    // Merge evidence, update description
    const existingEvidence = duplicate.evidence as { meetingIds: string[]; dates: string[]; tags: string[] }
    const mergedMeetingIds = [...new Set([...existingEvidence.meetingIds, ...detected.evidence.meetingIds])]
    const mergedDates = [...new Set([...existingEvidence.dates, ...detected.evidence.dates])]
    const mergedTags = [...new Set([...existingEvidence.tags, ...detected.evidence.tags])]

    await prisma.pattern.update({
      where: { id: duplicate.id },
      data: {
        description: detected.description,
        detectedAt: new Date(),
        evidence: { meetingIds: mergedMeetingIds, dates: mergedDates, tags: mergedTags },
      },
    })
    return
  }

  // Validate evidence has at least one meetingId (BR-4.03)
  if (detected.evidence.meetingIds.length === 0) return

  // Cap enforcement: evict least severe / oldest if at MAX (BR-4.20, P-4.05)
  const count = await prisma.pattern.count({ where: { teammateId } })

  if (count >= MAX_PATTERNS_PER_TEAMMATE) {
    // Severity enum sorts: ACTION_REQUIRED < INFORMATIONAL < WATCH alphabetically
    // We want to evict INFORMATIONAL first, then WATCH, never ACTION_REQUIRED
    // Use a manual priority: INFORMATIONAL=0, WATCH=1, ACTION_REQUIRED=2
    const severityOrder: Record<string, number> = { INFORMATIONAL: 0, WATCH: 1, ACTION_REQUIRED: 2 }
    const toEvict = existing
      .sort((a, b) => {
        const sevDiff = (severityOrder[a.severity] ?? 0) - (severityOrder[b.severity] ?? 0)
        if (sevDiff !== 0) return sevDiff
        return new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()
      })[0]

    if (toEvict) {
      await prisma.pattern.delete({ where: { id: toEvict.id } })
    }
  }

  await prisma.pattern.create({
    data: {
      teammateId,
      description: detected.description,
      severity: detected.severity,
      evidence: detected.evidence,
      detectedAt: new Date(),
    },
  })
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function detectPatterns(
  teammateId: string,
  managerId: string,
  client?: Anthropic
): Promise<void> {
  // BR-4.01: require at least 2 analyzed meetings
  const meetings = await prisma.meeting.findMany({
    where: { teammateId, managerId, status: 'ANALYSIS_COMPLETE' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, summary: true, tags: true, createdAt: true },
  })

  if (meetings.length < 2) return

  const teammate = await prisma.teammate.findFirst({
    where: { id: teammateId, managerId },
    select: { name: true },
  })

  const teammateName = teammate?.name ?? 'teammate'

  // Aggregate summaries (last 5, truncated) and tag frequencies
  const recentMeetings = meetings.slice(-5)
  const meetingSummaries = recentMeetings.map((m) =>
    (m.summary ?? '').slice(0, 500)
  )

  const tagFrequencies: Record<string, number> = {}
  for (const m of meetings) {
    for (const tag of m.tags) {
      tagFrequencies[tag] = (tagFrequencies[tag] ?? 0) + 1
    }
  }

  const prompt = buildPatternPrompt(meetingSummaries, tagFrequencies, teammateName)
  const anthropic = getClient(client)

  const message = await callClaudeWithRetry(() =>
    anthropic.messages.create({
      model: PATTERN_MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })
  )

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'
  const detected = parsePatternResponse(text)

  for (const pattern of detected) {
    await upsertPattern(teammateId, pattern)
  }
}
