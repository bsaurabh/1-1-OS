import Anthropic from '@anthropic-ai/sdk'

// ─── Constants ────────────────────────────────────────────────────────────────

export const FRAMEWORK_MODEL = 'claude-haiku-4-5-20251001'

export const VALID_FRAMEWORKS = ['GROW', 'SBI', 'STRENGTHS', 'OSCAR', 'SOCRATIC', 'MOTIVATIONAL'] as const
type Framework = typeof VALID_FRAMEWORKS[number]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoachingApproach {
  framework: string
  rationale: string
  actions: string[]
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

// ─── Fallback ─────────────────────────────────────────────────────────────────

export function fallbackApproach(): CoachingApproach {
  return {
    framework: 'General',
    rationale:
      'Not enough context to recommend a specific framework. Consider asking open-ended questions about what\'s going well and what feels hard right now.',
    actions: [
      'Ask what is going well and what feels challenging.',
      'Listen for energy and resistance cues.',
    ],
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildFrameworkSelectionPrompt(
  teammateName: string,
  profile: unknown,
  patterns: Array<{ severity: string; description: string }>,
  commitments: Array<{ carryCount: number }>
): string {
  const profileText =
    profile && typeof profile === 'object'
      ? Object.entries(profile as Record<string, unknown>)
          .filter(([k, v]) => v && !k.startsWith('_'))
          .map(([k, v]) => `  ${k}: ${String(v).slice(0, 200)}`)
          .join('\n')
      : '  (no profile data)'

  const topPatterns = patterns.slice(0, 5)
  const patternsText =
    topPatterns.length > 0
      ? topPatterns.map((p) => `  [${p.severity}] ${p.description}`).join('\n')
      : '  None'

  const carriedCount = commitments.filter((c) => c.carryCount >= 2).length

  return [
    `You are an AI coaching assistant helping a design manager select the best coaching framework for their 1:1.`,
    ``,
    `Teammate: ${teammateName}`,
    ``,
    `Profile:`,
    profileText,
    ``,
    `Active patterns:`,
    patternsText,
    ``,
    `Commitments carried forward 2+ times: ${carriedCount}`,
    ``,
    `Available frameworks:`,
    `  GROW — Goals, Reality, Options, Will — best for goal-setting conversations`,
    `  SBI — Situation, Behavior, Impact — best for feedback delivery`,
    `  STRENGTHS — Strengths-Based Coaching — best for motivation and energy`,
    `  OSCAR — Outcome, Situation, Choices, Actions, Review — best for structured problem-solving`,
    `  SOCRATIC — Socratic Questioning — best for building self-awareness`,
    `  MOTIVATIONAL — Motivational Interviewing — best for ambivalence and behavior change`,
    ``,
    `Select the single most appropriate framework for this teammate's current situation.`,
    `Return a JSON object with exactly these keys:`,
    `{`,
    `  "framework": "<one of: GROW|SBI|STRENGTHS|OSCAR|SOCRATIC|MOTIVATIONAL>",`,
    `  "rationale": "<2-3 sentences explaining why this framework fits this person now>",`,
    `  "actions": ["<1-2 concrete coaching actions to take in this 1:1>"]`,
    `}`,
    ``,
    `Rules:`,
    `- Return ONLY valid JSON. No prose, no markdown code fences.`,
    `- framework must be exactly one of the valid options listed above.`,
  ].join('\n')
}

// ─── Response parser ──────────────────────────────────────────────────────────

export function parseFrameworkResponse(text: string): CoachingApproach | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== 'object') return null

  const obj = parsed as Record<string, unknown>
  const framework = obj.framework as string
  const rationale = obj.rationale as string
  const actions = Array.isArray(obj.actions) ? (obj.actions as string[]) : []

  if (!(VALID_FRAMEWORKS as readonly string[]).includes(framework)) return null
  if (typeof rationale !== 'string' || !rationale.trim()) return null

  return { framework, rationale, actions }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function selectFramework(
  teammate: { profile: unknown; name: string },
  recentPatterns: Array<{ severity: string; description: string }>,
  openCommitments: Array<{ carryCount: number }>,
  client?: Anthropic
): Promise<CoachingApproach> {
  try {
    const prompt = buildFrameworkSelectionPrompt(
      teammate.name,
      teammate.profile,
      recentPatterns,
      openCommitments
    )

    const anthropic = getClient(client)
    const message = await callClaudeWithRetry(() =>
      anthropic.messages.create({
        model: FRAMEWORK_MODEL,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      })
    )

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const approach = parseFrameworkResponse(text)

    return approach ?? fallbackApproach()
  } catch (err) {
    console.error('[coachingStrategy] selectFramework failed, using fallback:', err)
    return fallbackApproach()
  }
}
