import Anthropic from '@anthropic-ai/sdk'
import {
  parseBriefResponse,
  buildFallback,
  formatBriefAsText,
  generateBrief,
  EmptyHistoryError,
  BriefParseError,
  BRIEF_MODEL,
  type Brief,
} from './briefGenerationHandler'

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    teammate: { findFirst: jest.fn() },
    meeting: { findMany: jest.fn() },
    commitment: { findMany: jest.fn() },
    pattern: { findMany: jest.fn() },
  },
}))

// Mock coachingStrategyHandler so we don't make real Claude calls in generateBrief tests
jest.mock('./coachingStrategyHandler', () => ({
  selectFramework: jest.fn().mockResolvedValue({
    framework: 'GROW',
    rationale: 'Good for goal-setting.',
    actions: ['Ask about Q2 goals.'],
  }),
}))

import { prisma } from '@/lib/prisma'

const mockTeammate = prisma.teammate as jest.Mocked<typeof prisma.teammate>
const mockMeeting = prisma.meeting as jest.Mocked<typeof prisma.meeting>
const mockCommitment = prisma.commitment as jest.Mocked<typeof prisma.commitment>
const mockPattern = prisma.pattern as jest.Mocked<typeof prisma.pattern>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMessage(text: string): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text, citations: null }],
    model: BRIEF_MODEL,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 20, output_tokens: 200, cache_creation_input_tokens: null, cache_read_input_tokens: null },
  }
}

function makeMockClient(text: string): Anthropic {
  return {
    messages: {
      create: jest.fn().mockResolvedValue(makeMessage(text)),
    },
  } as unknown as Anthropic
}

const validBriefResponse = {
  contextSummary: 'Alice has been focused on delivery and cross-team alignment.',
  coachingFocus: 'Explore what is blocking Alice from meeting deadlines.',
  riskSignals: ['Repeated missed deadlines flagged as ACTION_REQUIRED.'],
  followUpQuestions: [
    'What went well since our last meeting?',
    'What is your biggest blocker right now?',
    'How are you feeling about Q2 goals?',
    'What support do you need from me?',
    'Is there anything you would like to change about how we work together?',
  ],
  uncomfortableQuestion: 'Do you feel the team expects too much from you?',
}

const sampleBrief: Brief = {
  teammateId: 'tm-1',
  generatedAt: new Date().toISOString(),
  contextSummary: validBriefResponse.contextSummary,
  openCommitments: [{ text: 'Review OKRs', owner: 'MANAGER', status: 'OPEN', carryCount: 0 }],
  patterns: [{ description: 'Misses deadlines.', severity: 'WATCH', meetingCount: 3 }],
  coachingFocus: validBriefResponse.coachingFocus,
  riskSignals: validBriefResponse.riskSignals,
  followUpQuestions: validBriefResponse.followUpQuestions,
  uncomfortableQuestion: validBriefResponse.uncomfortableQuestion,
  coachingApproach: { framework: 'GROW', rationale: 'Good for goal-setting.', actions: ['Ask about Q2 goals.'] },
}

// ─── parseBriefResponse ───────────────────────────────────────────────────────

describe('parseBriefResponse', () => {
  it('parses valid JSON with all required fields', () => {
    const result = parseBriefResponse(JSON.stringify(validBriefResponse))
    expect(result.contextSummary).toBe(validBriefResponse.contextSummary)
    expect(result.coachingFocus).toBe(validBriefResponse.coachingFocus)
    expect(result.followUpQuestions).toHaveLength(5)
    expect(result.uncomfortableQuestion).toBe(validBriefResponse.uncomfortableQuestion)
    expect(result.riskSignals).toHaveLength(1)
  })

  it('extracts JSON from text with surrounding prose (regex fallback)', () => {
    const withProse = `Here is your brief:\n${JSON.stringify(validBriefResponse)}\nEnd.`
    const result = parseBriefResponse(withProse)
    expect(result.contextSummary).toBe(validBriefResponse.contextSummary)
  })

  it('throws BriefParseError for completely unparseable input', () => {
    expect(() => parseBriefResponse('no json here')).toThrow(BriefParseError)
  })

  it('throws BriefParseError when contextSummary is missing', () => {
    const missing = { ...validBriefResponse, contextSummary: '' }
    expect(() => parseBriefResponse(JSON.stringify(missing))).toThrow(BriefParseError)
  })

  it('throws BriefParseError when coachingFocus is missing', () => {
    const missing = { ...validBriefResponse, coachingFocus: '' }
    expect(() => parseBriefResponse(JSON.stringify(missing))).toThrow(BriefParseError)
  })

  it('throws BriefParseError when followUpQuestions is empty', () => {
    const missing = { ...validBriefResponse, followUpQuestions: [] }
    expect(() => parseBriefResponse(JSON.stringify(missing))).toThrow(BriefParseError)
  })

  it('throws BriefParseError when uncomfortableQuestion is missing', () => {
    const missing = { ...validBriefResponse, uncomfortableQuestion: '' }
    expect(() => parseBriefResponse(JSON.stringify(missing))).toThrow(BriefParseError)
  })

  it('accepts empty riskSignals array', () => {
    const withNoRisk = { ...validBriefResponse, riskSignals: [] }
    const result = parseBriefResponse(JSON.stringify(withNoRisk))
    expect(result.riskSignals).toHaveLength(0)
  })
})

// ─── buildFallback ────────────────────────────────────────────────────────────

describe('buildFallback', () => {
  it('maps commitment fields correctly', () => {
    const commitments = [
      { text: 'Follow up on OKRs', owner: 'MANAGER', status: 'OPEN', carryCount: 0 },
      { text: 'Write design doc', owner: 'TEAMMATE', status: 'CARRIED_FORWARD', carryCount: 2 },
    ]
    const result = buildFallback(commitments, null)
    expect(result.commitments).toHaveLength(2)
    expect(result.commitments[0].owner).toBe('MANAGER')
    expect(result.commitments[1].status).toBe('CARRIED_FORWARD')
  })

  it('includes last meeting summary when provided', () => {
    const meeting = { summary: 'We discussed Q2 targets.', createdAt: new Date('2024-06-01') }
    const result = buildFallback([], meeting)
    expect(result.lastMeetingSummary).toBe('We discussed Q2 targets.')
    expect(result.lastMeetingDate).toBe(new Date('2024-06-01').toISOString())
  })

  it('returns null fields when no last meeting', () => {
    const result = buildFallback([], null)
    expect(result.lastMeetingSummary).toBeNull()
    expect(result.lastMeetingDate).toBeNull()
  })

  it('returns null for lastMeetingSummary when meeting has no summary', () => {
    const meeting = { summary: null, createdAt: new Date() }
    const result = buildFallback([], meeting)
    expect(result.lastMeetingSummary).toBeNull()
  })
})

// ─── formatBriefAsText ────────────────────────────────────────────────────────

describe('formatBriefAsText', () => {
  it('produces a non-empty string', () => {
    const text = formatBriefAsText(sampleBrief, 'Alice')
    expect(text).toBeTruthy()
    expect(text.length).toBeGreaterThan(100)
  })

  it('includes teammate name in header', () => {
    const text = formatBriefAsText(sampleBrief, 'Alice')
    expect(text).toContain('Alice')
  })

  it('includes CONTEXT SUMMARY section', () => {
    const text = formatBriefAsText(sampleBrief, 'Alice')
    expect(text).toContain('CONTEXT SUMMARY')
    expect(text).toContain(sampleBrief.contextSummary)
  })

  it('includes COACHING APPROACH section with framework', () => {
    const text = formatBriefAsText(sampleBrief, 'Alice')
    expect(text).toContain('COACHING APPROACH')
    expect(text).toContain('GROW')
    expect(text).toContain('Good for goal-setting.')
  })

  it('includes FOLLOW-UP QUESTIONS section with numbered questions', () => {
    const text = formatBriefAsText(sampleBrief, 'Alice')
    expect(text).toContain('FOLLOW-UP QUESTIONS')
    expect(text).toContain('1. What went well since our last meeting?')
  })

  it('includes THE UNCOMFORTABLE QUESTION section', () => {
    const text = formatBriefAsText(sampleBrief, 'Alice')
    expect(text).toContain('UNCOMFORTABLE QUESTION')
    expect(text).toContain(sampleBrief.uncomfortableQuestion)
  })

  it('includes RISK SIGNALS section when riskSignals are present', () => {
    const text = formatBriefAsText(sampleBrief, 'Alice')
    expect(text).toContain('RISK SIGNALS')
    expect(text).toContain('Repeated missed deadlines')
  })

  it('omits RISK SIGNALS section when riskSignals is empty', () => {
    const briefNoRisk = { ...sampleBrief, riskSignals: [] }
    const text = formatBriefAsText(briefNoRisk, 'Alice')
    expect(text).not.toContain('RISK SIGNALS')
  })

  it('includes OPEN COMMITMENTS section', () => {
    const text = formatBriefAsText(sampleBrief, 'Alice')
    expect(text).toContain('OPEN COMMITMENTS')
    expect(text).toContain('Review OKRs')
  })
})

// ─── generateBrief ────────────────────────────────────────────────────────────

describe('generateBrief', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws EmptyHistoryError when no meetings exist (BR-4.06)', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ name: 'Alice', profile: {} })
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([])
    ;(mockCommitment.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPattern.findMany as jest.Mock).mockResolvedValue([])

    const client = makeMockClient('')
    await expect(generateBrief('mgr-1', 'tm-1', client)).rejects.toThrow(EmptyHistoryError)
  })

  it('returns { brief, fallback: null } on Claude success', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ name: 'Alice', profile: {} })
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1', summary: 'Discussed Q2 goals.', createdAt: new Date('2024-06-01') },
    ])
    ;(mockCommitment.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPattern.findMany as jest.Mock).mockResolvedValue([])

    const client = makeMockClient(JSON.stringify(validBriefResponse))
    const result = await generateBrief('mgr-1', 'tm-1', client)

    expect(result.brief).not.toBeNull()
    expect(result.fallback).toBeNull()
    expect(result.brief!.contextSummary).toBe(validBriefResponse.contextSummary)
    expect(result.brief!.teammateId).toBe('tm-1')
  })

  it('returns { brief: null, fallback } when Claude call fails (P-4.03)', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ name: 'Alice', profile: {} })
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1', summary: 'Some discussion.', createdAt: new Date() },
    ])
    ;(mockCommitment.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPattern.findMany as jest.Mock).mockResolvedValue([])

    const errorClient = {
      messages: {
        create: jest.fn().mockRejectedValue(new Error('Claude overloaded')),
      },
    } as unknown as Anthropic

    const result = await generateBrief('mgr-1', 'tm-1', errorClient)

    expect(result.brief).toBeNull()
    expect(result.fallback).not.toBeNull()
  })

  it('returns { brief: null, fallback } when Claude returns unparseable response (P-4.03)', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ name: 'Alice', profile: {} })
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1', summary: 'Discussion.', createdAt: new Date() },
    ])
    ;(mockCommitment.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPattern.findMany as jest.Mock).mockResolvedValue([])

    const client = makeMockClient('I am unable to generate a brief at this time.')
    const result = await generateBrief('mgr-1', 'tm-1', client)

    expect(result.brief).toBeNull()
    expect(result.fallback).not.toBeNull()
  })

  it('includes only WATCH + ACTION_REQUIRED patterns in brief (BR-4.10)', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ name: 'Alice', profile: {} })
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1', summary: 'Discussion.', createdAt: new Date() },
    ])
    ;(mockCommitment.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPattern.findMany as jest.Mock).mockResolvedValue([
      { description: 'Watch pattern.', severity: 'WATCH', detectedAt: new Date() },
      { description: 'Info pattern.', severity: 'INFORMATIONAL', detectedAt: new Date() },
      { description: 'Action pattern.', severity: 'ACTION_REQUIRED', detectedAt: new Date() },
    ])

    const client = makeMockClient(JSON.stringify(validBriefResponse))
    const result = await generateBrief('mgr-1', 'tm-1', client)

    expect(result.brief).not.toBeNull()
    const patternDescriptions = result.brief!.patterns.map((p) => p.description)
    expect(patternDescriptions).toContain('Watch pattern.')
    expect(patternDescriptions).toContain('Action pattern.')
    expect(patternDescriptions).not.toContain('Info pattern.')
  })

  it('includes open commitments in brief', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ name: 'Alice', profile: {} })
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1', summary: 'Discussion.', createdAt: new Date() },
    ])
    ;(mockCommitment.findMany as jest.Mock).mockResolvedValue([
      { text: 'Review OKRs', owner: 'MANAGER', status: 'OPEN', carryCount: 0 },
    ])
    ;(mockPattern.findMany as jest.Mock).mockResolvedValue([])

    const client = makeMockClient(JSON.stringify(validBriefResponse))
    const result = await generateBrief('mgr-1', 'tm-1', client)

    expect(result.brief).not.toBeNull()
    expect(result.brief!.openCommitments).toHaveLength(1)
    expect(result.brief!.openCommitments[0].text).toBe('Review OKRs')
  })
})
