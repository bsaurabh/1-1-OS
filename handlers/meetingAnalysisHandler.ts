import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { saveSuggested } from '@/lib/commitments'
import { detectPatterns } from './patternDetectionHandler'

// ─── Constants ────────────────────────────────────────────────────────────────

const ANALYSIS_MODEL = 'claude-sonnet-4-6'

const VALID_TAGS = [
  'alignment',
  'blocker',
  'career-growth',
  'celebration',
  'clarity-needed',
  'collaboration',
  'conflict',
  'deadline',
  'decision',
  'feedback',
  'goal',
  'morale',
  'performance',
  'prioritization',
  'process',
  'recognition',
  'resource',
  'risk',
  'scope',
  'workload',
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  summary: string
  tone: string
  themes: string[]
  tags: string[]
  commitments: Array<{ text: string; owner: 'MANAGER' | 'TEAMMATE' }>
}

export class AnalysisParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnalysisParseError'
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

async function callClaudeWithRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 1000
): Promise<T> {
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

export function buildAnalysisPrompt(rawText: string, teammateName: string): string {
  const validTagsList = VALID_TAGS.join(', ')

  return [
    `You are an AI assistant helping a design manager analyze their 1:1 meeting notes.`,
    ``,
    `Teammate name: ${teammateName}`,
    ``,
    `Meeting notes:`,
    `"""`,
    rawText,
    `"""`,
    ``,
    `Analyze these meeting notes and return a JSON object with exactly these keys:`,
    `{`,
    `  "summary": "2-3 sentence summary of the main discussion points",`,
    `  "tone": "one word or short phrase describing the overall tone (e.g., productive, tense, collaborative, exploratory)",`,
    `  "themes": ["array", "of", "2-5", "main", "themes", "discussed"],`,
    `  "tags": ["array of tags from the allowed list only"],`,
    `  "commitments": [`,
    `    { "text": "action item text", "owner": "MANAGER" or "TEAMMATE" }`,
    `  ]`,
    `}`,
    ``,
    `Allowed tags (use only from this list): ${validTagsList}`,
    ``,
    `Rules:`,
    `- Return ONLY valid JSON. No prose, no markdown code fences, no explanation.`,
    `- tags must only contain values from the allowed list above`,
    `- commitments should only include explicit action items or follow-ups mentioned`,
    `- owner must be exactly "MANAGER" or "TEAMMATE"`,
  ].join('\n')
}

// ─── Response parser ──────────────────────────────────────────────────────────

export function parseAnalysisResponse(text: string): AnalysisResult {
  // Attempt 1: direct JSON parse
  try {
    const parsed = JSON.parse(text)
    return validateAndFilter(parsed)
  } catch {
    // fall through
  }

  // Attempt 2: extract JSON block via regex
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      return validateAndFilter(parsed)
    } catch {
      // fall through
    }
  }

  throw new AnalysisParseError(`Failed to parse Claude analysis response: ${text.slice(0, 200)}`)
}

function validateAndFilter(parsed: unknown): AnalysisResult {
  if (!parsed || typeof parsed !== 'object') {
    throw new AnalysisParseError('Response is not an object')
  }

  const obj = parsed as Record<string, unknown>

  const summary = typeof obj.summary === 'string' ? obj.summary : ''
  const tone = typeof obj.tone === 'string' ? obj.tone : 'neutral'
  const themes = Array.isArray(obj.themes) ? obj.themes.filter((t) => typeof t === 'string') : []

  // Filter tags against VALID_TAGS
  const rawTags = Array.isArray(obj.tags) ? obj.tags : []
  const tags = rawTags.filter((t): t is string =>
    typeof t === 'string' && (VALID_TAGS as readonly string[]).includes(t)
  )

  const rawCommitments = Array.isArray(obj.commitments) ? obj.commitments : []
  const commitments = rawCommitments
    .filter(
      (c) =>
        c &&
        typeof c === 'object' &&
        typeof (c as Record<string, unknown>).text === 'string' &&
        ((c as Record<string, unknown>).owner === 'MANAGER' ||
          (c as Record<string, unknown>).owner === 'TEAMMATE')
    )
    .map((c) => ({
      text: (c as { text: string; owner: 'MANAGER' | 'TEAMMATE' }).text,
      owner: (c as { text: string; owner: 'MANAGER' | 'TEAMMATE' }).owner,
    }))

  return { summary, tone, themes, tags, commitments }
}

// ─── Main analyze function ────────────────────────────────────────────────────

export async function analyze(
  meetingId: string,
  client?: Anthropic
): Promise<void> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { teammate: { select: { name: true, managerId: true, id: true } } },
  })

  if (!meeting) throw new Error(`Meeting ${meetingId} not found`)

  const prompt = buildAnalysisPrompt(meeting.rawText, meeting.teammate.name)
  const anthropic = getClient(client)

  const message = await callClaudeWithRetry(() =>
    anthropic.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })
  )

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const result = parseAnalysisResponse(text)

  await onComplete(meeting.id, meeting.teammate.managerId, meeting.teammate.id, result)
}

export async function onComplete(
  meetingId: string,
  managerId: string,
  teammateId: string,
  result: AnalysisResult
): Promise<void> {
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: 'ANALYSIS_COMPLETE',
      summary: result.summary,
      tone: result.tone,
      themes: result.themes,
      tags: result.tags,
    },
  })

  if (result.commitments.length > 0) {
    await saveSuggested(managerId, teammateId, meetingId, result.commitments)
  }

  // P-4.01: pattern detection chained as isolated side-effect
  try {
    await detectPatterns(teammateId, managerId)
  } catch (err) {
    // BR-4.05: pattern failure must NOT affect ANALYSIS_COMPLETE status
    console.error('[patternDetection] failed for teammate', teammateId, err)
  }
}
