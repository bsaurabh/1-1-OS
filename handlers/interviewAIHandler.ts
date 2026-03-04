import Anthropic from '@anthropic-ai/sdk'

// ─── Types ───────────────────────────────────────────────────────────────────

export enum ProfileArea {
  STRENGTHS              = 'strengths',
  GROWTH_AREAS           = 'growthAreas',
  ASPIRATIONS            = 'aspirations',
  KPIS                   = 'kpis',
  BEHAVIORAL_TENDENCIES  = 'behavioralTendencies',
  FEEDBACK_STYLE         = 'feedbackStyle',
  MOTIVATION_DRIVERS     = 'motivationDrivers',
}

export interface ProfileFields {
  strengths?:            string
  growthAreas?:          string
  aspirations?:          string
  kpis?:                 string
  behavioralTendencies?: string
  feedbackStyle?:        string
  motivationDrivers?:    string
  _rawAnswers?:          ConversationTurn[]  // fallback storage only
}

export interface ConversationTurn {
  questionIndex: number
  area:          ProfileArea
  question:      string
  answer:        string
}

export interface NextQuestionResult {
  question:      string
  questionIndex: number
  area:          ProfileArea
  isComplete:    boolean
}

export interface GenerateProfileResult {
  profile:  ProfileFields
  warning?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTERVIEW_MODEL = 'claude-haiku-4-5-20251001'
const SYNTHESIS_MODEL = 'claude-sonnet-4-6'

const INTERVIEW_AREAS: ProfileArea[] = [
  ProfileArea.STRENGTHS,
  ProfileArea.GROWTH_AREAS,
  ProfileArea.ASPIRATIONS,
  ProfileArea.KPIS,
  ProfileArea.BEHAVIORAL_TENDENCIES,
  ProfileArea.FEEDBACK_STYLE,
  ProfileArea.MOTIVATION_DRIVERS,
]

const AREA_LABELS: Record<ProfileArea, string> = {
  [ProfileArea.STRENGTHS]:             'key strengths',
  [ProfileArea.GROWTH_AREAS]:          'growth areas',
  [ProfileArea.ASPIRATIONS]:           'career aspirations',
  [ProfileArea.KPIS]:                  'KPIs and success metrics',
  [ProfileArea.BEHAVIORAL_TENDENCIES]: 'behavioral tendencies',
  [ProfileArea.FEEDBACK_STYLE]:        'preferred feedback style',
  [ProfileArea.MOTIVATION_DRIVERS]:    'motivation drivers',
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
  delayMs = 1000,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (retries > 0 && isTransientClaudeError(err)) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
      return callClaudeWithRetry(fn, retries - 1, delayMs)
    }
    throw err
  }
}

function isTransientClaudeError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return err.status >= 500 || err.status === 529 || err.status === 429
  }
  return err instanceof Error && err.message.toLowerCase().includes('fetch')
}

// ─── Input sanitization ───────────────────────────────────────────────────────

function sanitizeAnswer(answer: string): string {
  return answer.slice(0, 2000).trim()
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildNextQuestionPrompt(
  teammateName: string,
  role: string,
  history: ConversationTurn[],
  latestAnswer: string,
  nextArea: ProfileArea,
): string {
  const nextIndex = history.length + 1
  const areaLabel = AREA_LABELS[nextArea]

  if (history.length === 0) {
    return [
      `You are conducting a brief onboarding interview with a design manager about their direct report.`,
      `You are building a coaching profile to help the manager support this person more effectively.`,
      ``,
      `Direct report name: ${teammateName}`,
      `Role: ${role}`,
      ``,
      `This is question 1 of 7. The topic is: ${areaLabel}.`,
      `Ask one natural, conversational question about this topic.`,
      `Keep the question concise (1–2 sentences). Do not explain what you will do next.`,
    ].join('\n')
  }

  const historyText = history
    .map(t => `Q: ${t.question}\nA: ${t.answer}`)
    .join('\n\n')

  return [
    `You are conducting an onboarding interview with a design manager about ${teammateName} (${role}).`,
    ``,
    `Conversation so far:`,
    historyText,
    ``,
    `Manager's latest answer: "${sanitizeAnswer(latestAnswer)}"`,
    ``,
    `This is question ${nextIndex} of 7. The topic is: ${areaLabel}.`,
    `Briefly acknowledge their previous answer (1 sentence), then ask one conversational question about ${areaLabel}.`,
    `Keep the full response under 3 sentences. Do not number the question.`,
  ].join('\n')
}

function buildSynthesisPrompt(
  teammateName: string,
  role: string,
  history: ConversationTurn[],
): string {
  const qaText = history
    .map(t => `[${AREA_LABELS[t.area]}]\nQ: ${t.question}\nA: ${t.answer}`)
    .join('\n\n')

  return [
    `You are a coaching profile synthesizer. Based on the following interview answers from a design manager`,
    `about their direct report ${teammateName} (role: ${role}), generate a structured coaching profile.`,
    ``,
    `Interview Q&A:`,
    qaText,
    ``,
    `Output a JSON object with exactly these keys. Write clear, concise coaching-relevant summaries`,
    `in third person (e.g., "Shows strong systems thinking..."). Each value should be 1–3 sentences.`,
    `Use null for any area where the manager's answer provided insufficient information.`,
    ``,
    `{`,
    `  "strengths": "...",`,
    `  "growthAreas": "...",`,
    `  "aspirations": "...",`,
    `  "kpis": "...",`,
    `  "behavioralTendencies": "...",`,
    `  "feedbackStyle": "...",`,
    `  "motivationDrivers": "..."`,
    `}`,
    ``,
    `Return ONLY valid JSON. No prose, no markdown code fences, no explanation.`,
  ].join('\n')
}

// ─── JSON parser with fallback ────────────────────────────────────────────────

function parseProfileJSON(text: string): ProfileFields | null {
  // Attempt 1: direct parse
  try {
    return JSON.parse(text) as ProfileFields
  } catch {
    // fall through
  }

  // Attempt 2: extract first JSON block via regex
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0]) as ProfileFields
    } catch {
      // fall through
    }
  }

  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate the next interview question.
 * Call with empty conversationHistory and no latestAnswer to get Q1.
 * Returns isComplete: true when all 7 questions have been answered.
 */
export async function nextQuestion(
  teammateName: string,
  role: string,
  conversationHistory: ConversationTurn[],
  latestAnswer: string,
  client?: Anthropic,
): Promise<NextQuestionResult> {
  const nextIndex = conversationHistory.length + 1

  // All 7 answered — signal completion without calling Claude
  if (nextIndex > INTERVIEW_AREAS.length) {
    return {
      question:      '',
      questionIndex: INTERVIEW_AREAS.length,
      area:          INTERVIEW_AREAS[INTERVIEW_AREAS.length - 1],
      isComplete:    true,
    }
  }

  const nextArea = INTERVIEW_AREAS[nextIndex - 1]
  const prompt = buildNextQuestionPrompt(
    teammateName,
    role,
    conversationHistory,
    latestAnswer,
    nextArea,
  )

  const anthropic = getClient(client)

  const message = await callClaudeWithRetry(() =>
    anthropic.messages.create({
      model:     INTERVIEW_MODEL,
      max_tokens: 300,
      messages:  [{ role: 'user', content: prompt }],
    }),
  )

  const question =
    message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  return {
    question,
    questionIndex: nextIndex,
    area:          nextArea,
    isComplete:    false,
  }
}

/**
 * Synthesize a ProfileFields object from all 7 completed interview turns.
 * Uses Claude Sonnet for higher-quality structured output.
 */
export async function generateProfile(
  teammateName: string,
  role: string,
  conversationHistory: ConversationTurn[],
  client?: Anthropic,
): Promise<GenerateProfileResult> {
  const prompt = buildSynthesisPrompt(teammateName, role, conversationHistory)
  const anthropic = getClient(client)

  const message = await callClaudeWithRetry(() =>
    anthropic.messages.create({
      model:     SYNTHESIS_MODEL,
      max_tokens: 1024,
      messages:  [{ role: 'user', content: prompt }],
    }),
  )

  const text =
    message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  const parsed = parseProfileJSON(text)

  if (parsed) {
    return { profile: parsed }
  }

  // Fallback: store raw Q&A so no data is lost
  console.error('[interviewAIHandler] Profile JSON parse failed. Storing raw answers.')
  return {
    profile: { _rawAnswers: conversationHistory },
    warning: 'Profile auto-fill failed — answers saved, please review manually.',
  }
}
