import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { selectFramework, type CoachingApproach } from './coachingStrategyHandler'

// ─── Constants ────────────────────────────────────────────────────────────────

export const BRIEF_MODEL = 'claude-sonnet-4-6'
export const MAX_MEETINGS_FOR_BRIEF = 10

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BriefCommitment {
  text: string
  owner: 'MANAGER' | 'TEAMMATE'
  status: 'OPEN' | 'CARRIED_FORWARD'
  carryCount: number
}

export interface BriefPattern {
  description: string
  severity: 'INFORMATIONAL' | 'WATCH' | 'ACTION_REQUIRED'
  meetingCount: number
}

export interface Brief {
  teammateId: string
  generatedAt: string
  contextSummary: string
  openCommitments: BriefCommitment[]
  patterns: BriefPattern[]
  coachingFocus: string
  riskSignals: string[]
  followUpQuestions: string[]
  uncomfortableQuestion: string
  coachingApproach: CoachingApproach
}

export interface BriefFallback {
  commitments: BriefCommitment[]
  lastMeetingSummary: string | null
  lastMeetingDate: string | null
}

export class EmptyHistoryError extends Error {
  constructor() {
    super('No meeting history')
    this.name = 'EmptyHistoryError'
  }
}

export class BriefParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BriefParseError'
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

// ─── Fallback builder ─────────────────────────────────────────────────────────

export function buildFallback(
  commitments: Array<{ text: string; owner: string; status: string; carryCount: number }>,
  lastMeeting: { summary?: string | null; createdAt: Date } | null
): BriefFallback {
  return {
    commitments: commitments.map((c) => ({
      text: c.text,
      owner: c.owner as 'MANAGER' | 'TEAMMATE',
      status: c.status as 'OPEN' | 'CARRIED_FORWARD',
      carryCount: c.carryCount,
    })),
    lastMeetingSummary: lastMeeting?.summary ?? null,
    lastMeetingDate: lastMeeting ? lastMeeting.createdAt.toISOString() : null,
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildBriefPrompt(context: {
  teammateName: string
  profile: unknown
  meetingSummaries: string[]
  openCommitments: Array<{ text: string; owner: string; status: string; carryCount: number }>
  patterns: Array<{ description: string; severity: string }>
  coachingApproach: CoachingApproach
}): string {
  const profileText =
    context.profile && typeof context.profile === 'object'
      ? Object.entries(context.profile as Record<string, unknown>)
          .filter(([k, v]) => v && !k.startsWith('_'))
          .map(([k, v]) => `  ${k}: ${String(v).slice(0, 300)}`)
          .join('\n')
      : '  (no profile data)'

  const commitmentsText =
    context.openCommitments.length > 0
      ? context.openCommitments
          .map(
            (c) =>
              `  [${c.owner}/${c.status}${c.carryCount >= 2 ? `/carried ${c.carryCount}x` : ''}] ${c.text}`
          )
          .join('\n')
      : '  None'

  const patternsText =
    context.patterns.filter((p) => p.severity !== 'INFORMATIONAL').length > 0
      ? context.patterns
          .filter((p) => p.severity !== 'INFORMATIONAL')
          .map((p) => `  [${p.severity}] ${p.description}`)
          .join('\n')
      : '  None'

  const meetingsText = context.meetingSummaries
    .map((s, i) => `Meeting ${i + 1}: ${s}`)
    .join('\n\n')

  return [
    `You are an AI assistant generating a pre-meeting brief for a design manager's 1:1.`,
    ``,
    `Teammate: ${context.teammateName}`,
    `Coaching framework for this session: ${context.coachingApproach.framework} — ${context.coachingApproach.rationale}`,
    ``,
    `Teammate profile:`,
    profileText,
    ``,
    `Recent meeting history (most recent last):`,
    `"""`,
    meetingsText,
    `"""`,
    ``,
    `Open commitments:`,
    commitmentsText,
    ``,
    `Active patterns (WATCH + ACTION_REQUIRED only):`,
    patternsText,
    ``,
    `Generate a structured pre-meeting brief. Return a JSON object with exactly these keys:`,
    `{`,
    `  "contextSummary": "2-3 sentence recap of recent meeting themes and overall trajectory",`,
    `  "coachingFocus": "1-2 sentence suggested focus area for this 1:1 based on patterns and commitments",`,
    `  "riskSignals": ["array of strings — ACTION_REQUIRED pattern descriptions, may be empty"],`,
    `  "followUpQuestions": ["5-7 specific follow-up questions based on the meeting history"],`,
    `  "uncomfortableQuestion": "the one bold question the manager should ask but might avoid"`,
    `}`,
    ``,
    `Rules:`,
    `- Return ONLY valid JSON. No prose, no markdown code fences.`,
    `- followUpQuestions must have 5-7 items.`,
    `- uncomfortableQuestion must be non-empty.`,
    `- Base everything on the actual meeting history provided.`,
  ].join('\n')
}

// ─── Response parser ──────────────────────────────────────────────────────────

export function parseBriefResponse(text: string): {
  contextSummary: string
  coachingFocus: string
  riskSignals: string[]
  followUpQuestions: string[]
  uncomfortableQuestion: string
} {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new BriefParseError(`Failed to parse brief response: ${text.slice(0, 200)}`)
    try {
      parsed = JSON.parse(match[0])
    } catch {
      throw new BriefParseError(`Failed to parse extracted brief JSON: ${text.slice(0, 200)}`)
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new BriefParseError('Brief response is not an object')
  }

  const obj = parsed as Record<string, unknown>

  const contextSummary = typeof obj.contextSummary === 'string' ? obj.contextSummary.trim() : ''
  const coachingFocus = typeof obj.coachingFocus === 'string' ? obj.coachingFocus.trim() : ''
  const riskSignals = Array.isArray(obj.riskSignals)
    ? (obj.riskSignals as unknown[]).filter((r): r is string => typeof r === 'string')
    : []
  const followUpQuestions = Array.isArray(obj.followUpQuestions)
    ? (obj.followUpQuestions as unknown[]).filter((q): q is string => typeof q === 'string')
    : []
  const uncomfortableQuestion =
    typeof obj.uncomfortableQuestion === 'string' ? obj.uncomfortableQuestion.trim() : ''

  // BR-4.08: validate required fields
  if (!contextSummary) throw new BriefParseError('contextSummary is missing or empty')
  if (!coachingFocus) throw new BriefParseError('coachingFocus is missing or empty')
  if (followUpQuestions.length === 0) throw new BriefParseError('followUpQuestions is empty')
  if (!uncomfortableQuestion) throw new BriefParseError('uncomfortableQuestion is missing or empty')

  return { contextSummary, coachingFocus, riskSignals, followUpQuestions, uncomfortableQuestion }
}

// ─── Brief text serializer (P-4.07) ──────────────────────────────────────────

export function formatBriefAsText(brief: Brief, teammateName: string): string {
  const lines: string[] = [
    `PRE-MEETING BRIEF — ${teammateName}`,
    `Generated: ${new Date(brief.generatedAt).toLocaleDateString()}`,
    '',
    '--- CONTEXT SUMMARY ---',
    brief.contextSummary,
    '',
  ]

  if (brief.riskSignals.length > 0) {
    lines.push('--- RISK SIGNALS ---')
    lines.push(...brief.riskSignals.map((r) => `⚠ ${r}`))
    lines.push('')
  }

  lines.push(
    '--- OPEN COMMITMENTS ---',
    ...(brief.openCommitments.length > 0
      ? brief.openCommitments.map(
          (c, i) =>
            `${i + 1}. [${c.owner}] ${c.text} (${c.status}${c.carryCount >= 2 ? ` — carried ${c.carryCount}x` : ''})`
        )
      : ['None.']),
    '',
    '--- ACTIVE PATTERNS ---',
    ...(brief.patterns.length > 0
      ? brief.patterns.map((p) => `• [${p.severity}] ${p.description}`)
      : ['No active patterns.']),
    '',
    '--- COACHING FOCUS ---',
    brief.coachingFocus,
    '',
    '--- COACHING APPROACH ---',
    `Framework: ${brief.coachingApproach.framework}`,
    brief.coachingApproach.rationale,
    ...brief.coachingApproach.actions.map((a) => `• ${a}`),
    '',
    '--- FOLLOW-UP QUESTIONS ---',
    ...brief.followUpQuestions.map((q, i) => `${i + 1}. ${q}`),
    '',
    '--- THE UNCOMFORTABLE QUESTION ---',
    brief.uncomfortableQuestion,
  )

  return lines.join('\n')
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generateBrief(
  managerId: string,
  teammateId: string,
  client?: Anthropic
): Promise<{ brief: Brief | null; fallback: BriefFallback | null }> {
  // P-4.02: all 4 DB reads in parallel
  const [teammate, meetings, openCommitments, patterns] = await Promise.all([
    prisma.teammate.findFirst({
      where: { id: teammateId, managerId },
      select: { name: true, profile: true },
    }),
    prisma.meeting.findMany({
      where: { teammateId, managerId, status: 'ANALYSIS_COMPLETE' },
      orderBy: { createdAt: 'desc' },
      take: MAX_MEETINGS_FOR_BRIEF,
      select: { id: true, summary: true, createdAt: true },
    }),
    prisma.commitment.findMany({
      where: { teammateId, managerId, status: { in: ['OPEN', 'CARRIED_FORWARD'] } },
      orderBy: { createdAt: 'asc' },
      select: { text: true, owner: true, status: true, carryCount: true },
    }),
    prisma.pattern.findMany({
      where: { teammateId },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
      select: { description: true, severity: true, detectedAt: true },
    }),
  ])

  if (!teammate) throw new Error('Teammate not found')

  // BR-4.06: guard — no history
  if (meetings.length === 0) throw new EmptyHistoryError()

  const briefCommitments: BriefCommitment[] = openCommitments.map((c) => ({
    text: c.text,
    owner: c.owner as 'MANAGER' | 'TEAMMATE',
    status: c.status as 'OPEN' | 'CARRIED_FORWARD',
    carryCount: c.carryCount,
  }))

  try {
    // P-4.04: Haiku for framework selection
    const coachingApproach = await selectFramework(
      { name: teammate.name, profile: teammate.profile },
      patterns.slice(0, 5).map((p) => ({ severity: p.severity, description: p.description })),
      openCommitments.map((c) => ({ carryCount: c.carryCount })),
      client
    )

    // Build brief prompt with all context
    const meetingSummaries = [...meetings]
      .reverse()
      .map((m) => (m.summary ?? '').slice(0, 500))

    const prompt = buildBriefPrompt({
      teammateName: teammate.name,
      profile: teammate.profile,
      meetingSummaries,
      openCommitments,
      patterns: patterns.map((p) => ({ description: p.description, severity: p.severity })),
      coachingApproach,
    })

    // P-4.04: Sonnet for brief synthesis
    const anthropic = getClient(client)
    const message = await callClaudeWithRetry(() =>
      anthropic.messages.create({
        model: BRIEF_MODEL,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      })
    )

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const parsed = parseBriefResponse(text)

    // BR-4.10: only WATCH + ACTION_REQUIRED in brief patterns
    const briefPatterns: BriefPattern[] = patterns
      .filter((p) => p.severity === 'WATCH' || p.severity === 'ACTION_REQUIRED')
      .map((p) => ({
        description: p.description,
        severity: p.severity as 'WATCH' | 'ACTION_REQUIRED',
        meetingCount: meetings.length,
      }))

    const brief: Brief = {
      teammateId,
      generatedAt: new Date().toISOString(),
      contextSummary: parsed.contextSummary,
      openCommitments: briefCommitments,
      patterns: briefPatterns,
      coachingFocus: parsed.coachingFocus,
      riskSignals: parsed.riskSignals,
      followUpQuestions: parsed.followUpQuestions,
      uncomfortableQuestion: parsed.uncomfortableQuestion,
      coachingApproach,
    }

    return { brief, fallback: null }
  } catch (err) {
    // P-4.03: graceful degradation — never return blank page (BR-4.09)
    if (err instanceof EmptyHistoryError) throw err
    console.error('[briefGeneration] failed, returning fallback:', err)
    const fallback = buildFallback(openCommitments, meetings[0] ?? null)
    return { brief: null, fallback }
  }
}
