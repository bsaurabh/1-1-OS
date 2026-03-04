import Anthropic from '@anthropic-ai/sdk'
import {
  buildPatternPrompt,
  parsePatternResponse,
  detectPatterns,
  PatternParseError,
  PATTERN_MODEL,
  VALID_SEVERITIES,
  MAX_PATTERNS_PER_TEAMMATE,
} from './patternDetectionHandler'

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    meeting: { findMany: jest.fn() },
    teammate: { findFirst: jest.fn() },
    pattern: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

const mockMeeting = prisma.meeting as jest.Mocked<typeof prisma.meeting>
const mockTeammate = prisma.teammate as jest.Mocked<typeof prisma.teammate>
const mockPattern = prisma.pattern as jest.Mocked<typeof prisma.pattern>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMessage(text: string): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text, citations: null }],
    model: PATTERN_MODEL,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 50, cache_creation_input_tokens: null, cache_read_input_tokens: null },
  }
}

function makeMockClient(text: string): Anthropic {
  return {
    messages: {
      create: jest.fn().mockResolvedValue(makeMessage(text)),
    },
  } as unknown as Anthropic
}

// ─── buildPatternPrompt ───────────────────────────────────────────────────────

describe('buildPatternPrompt', () => {
  it('includes teammate name', () => {
    const prompt = buildPatternPrompt(['Summary 1', 'Summary 2'], {}, 'Alice')
    expect(prompt).toContain('Alice')
  })

  it('includes meeting summaries', () => {
    const prompt = buildPatternPrompt(['We discussed goals.', 'Delivery delays came up.'], {}, 'Bob')
    expect(prompt).toContain('We discussed goals.')
    expect(prompt).toContain('Delivery delays came up.')
  })

  it('includes top tag frequencies sorted by count', () => {
    const tagFreqs = { 'feedback': 5, 'goal': 3, 'delivery': 2 }
    const prompt = buildPatternPrompt(['Summary'], tagFreqs, 'Carol')
    expect(prompt).toContain('feedback (5x)')
    expect(prompt).toContain('goal (3x)')
  })

  it('handles empty tag frequencies', () => {
    const prompt = buildPatternPrompt(['Summary'], {}, 'Dan')
    expect(prompt).toContain('none')
  })

  it('requires JSON-only output', () => {
    const prompt = buildPatternPrompt([], {}, 'Eve')
    expect(prompt).toContain('Return ONLY a valid JSON array')
  })

  it('includes severity guide with all three severities', () => {
    const prompt = buildPatternPrompt([], {}, 'Frank')
    for (const s of VALID_SEVERITIES) {
      expect(prompt).toContain(s)
    }
  })
})

// ─── parsePatternResponse ─────────────────────────────────────────────────────

describe('parsePatternResponse', () => {
  const validItem = {
    description: 'Consistently misses deadlines.',
    severity: 'WATCH',
    evidence: { meetingIds: ['m1', 'm2'], dates: ['2024-01-01'], tags: ['delivery', 'deadline'] },
  }

  it('parses valid JSON array', () => {
    const result = parsePatternResponse(JSON.stringify([validItem]))
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('Consistently misses deadlines.')
    expect(result[0].severity).toBe('WATCH')
    expect(result[0].evidence.tags).toContain('delivery')
  })

  it('returns empty array for []', () => {
    expect(parsePatternResponse('[]')).toHaveLength(0)
  })

  it('filters out items with invalid severity', () => {
    const withBadSeverity = [
      validItem,
      { ...validItem, severity: 'CRITICAL' },
    ]
    const result = parsePatternResponse(JSON.stringify(withBadSeverity))
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('WATCH')
  })

  it('filters out items missing description', () => {
    const withNoDesc = [{ severity: 'WATCH', evidence: { meetingIds: [], dates: [], tags: ['a', 'b'] } }]
    const result = parsePatternResponse(JSON.stringify(withNoDesc))
    expect(result).toHaveLength(0)
  })

  it('filters out items missing evidence', () => {
    const withNoEvidence = [{ description: 'Pattern', severity: 'WATCH' }]
    const result = parsePatternResponse(JSON.stringify(withNoEvidence))
    expect(result).toHaveLength(0)
  })

  it('extracts JSON from text with surrounding prose (regex fallback)', () => {
    const withProse = `Here are the patterns:\n${JSON.stringify([validItem])}\nEnd.`
    const result = parsePatternResponse(withProse)
    expect(result).toHaveLength(1)
  })

  it('throws PatternParseError for completely unparseable input', () => {
    expect(() => parsePatternResponse('not json at all')).toThrow(PatternParseError)
  })

  it('throws PatternParseError when response is not an array', () => {
    expect(() => parsePatternResponse(JSON.stringify({ patterns: [] }))).toThrow(PatternParseError)
  })
})

// ─── detectPatterns ───────────────────────────────────────────────────────────

describe('detectPatterns', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns early without calling Claude when fewer than 2 meetings (BR-4.01)', async () => {
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1', summary: 'First meeting.', tags: [], createdAt: new Date() },
    ])

    const client = makeMockClient('[]')
    await detectPatterns('tm-1', 'mgr-1', client)

    expect((client.messages.create as jest.Mock)).not.toHaveBeenCalled()
  })

  it('returns early without calling Claude when 0 meetings', async () => {
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([])

    const client = makeMockClient('[]')
    await detectPatterns('tm-1', 'mgr-1', client)

    expect((client.messages.create as jest.Mock)).not.toHaveBeenCalled()
  })

  it('calls Claude and upserts patterns when ≥ 2 meetings', async () => {
    const meetings = [
      { id: 'm1', summary: 'We discussed goals.', tags: ['goal'], createdAt: new Date('2024-01-01') },
      { id: 'm2', summary: 'Goals came up again.', tags: ['goal', 'feedback'], createdAt: new Date('2024-01-15') },
    ]
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue(meetings)
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ name: 'Alice' })

    const detectedPattern = {
      description: 'Recurring goal-setting discussions.',
      severity: 'WATCH',
      evidence: { meetingIds: ['m1', 'm2'], dates: ['2024-01-01', '2024-01-15'], tags: ['goal'] },
    }
    const client = makeMockClient(JSON.stringify([detectedPattern]))

    ;(mockPattern.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPattern.count as jest.Mock).mockResolvedValue(0)
    ;(mockPattern.create as jest.Mock).mockResolvedValue({})

    await detectPatterns('tm-1', 'mgr-1', client)

    expect((client.messages.create as jest.Mock)).toHaveBeenCalledTimes(1)
    expect(mockPattern.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: 'Recurring goal-setting discussions.' }),
      })
    )
  })

  it('does not create pattern when response is empty array', async () => {
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1', summary: 'S1', tags: [], createdAt: new Date() },
      { id: 'm2', summary: 'S2', tags: [], createdAt: new Date() },
    ])
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ name: 'Bob' })

    const client = makeMockClient('[]')

    await detectPatterns('tm-1', 'mgr-1', client)

    expect(mockPattern.create).not.toHaveBeenCalled()
  })
})

// ─── upsertPattern (via detectPatterns) dedup + eviction ─────────────────────

describe('upsertPattern dedup and eviction (via detectPatterns)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('updates existing pattern when same severity + ≥2 tag overlap (dedup)', async () => {
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1', summary: 'S1', tags: ['delivery', 'deadline'], createdAt: new Date() },
      { id: 'm2', summary: 'S2', tags: ['delivery', 'deadline'], createdAt: new Date() },
    ])
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ name: 'Alice' })

    const existingPattern = {
      id: 'existing-1',
      severity: 'WATCH',
      evidence: { meetingIds: ['m0'], dates: [], tags: ['delivery', 'deadline'] },
      detectedAt: new Date(),
    }
    ;(mockPattern.findMany as jest.Mock).mockResolvedValue([existingPattern])
    ;(mockPattern.update as jest.Mock).mockResolvedValue({})

    const newPattern = {
      description: 'Delivery delays reoccurring.',
      severity: 'WATCH',
      evidence: { meetingIds: ['m1', 'm2'], dates: [], tags: ['delivery', 'deadline', 'release'] },
    }
    const client = makeMockClient(JSON.stringify([newPattern]))

    await detectPatterns('tm-1', 'mgr-1', client)

    expect(mockPattern.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'existing-1' } })
    )
    expect(mockPattern.create).not.toHaveBeenCalled()
  })

  it('evicts least severe / oldest pattern when count is at MAX (P-4.05)', async () => {
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1', summary: 'S1', tags: ['unique-tag-x'], createdAt: new Date() },
      { id: 'm2', summary: 'S2', tags: ['unique-tag-x'], createdAt: new Date() },
    ])
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue({ name: 'Carol' })

    // Build MAX existing patterns (all INFORMATIONAL so one can be evicted)
    const existing = Array.from({ length: MAX_PATTERNS_PER_TEAMMATE }, (_, i) => ({
      id: `p${i}`,
      severity: 'INFORMATIONAL',
      evidence: { tags: [`tag${i}`] },
      detectedAt: new Date(2024, 0, i + 1),
    }))
    ;(mockPattern.findMany as jest.Mock).mockResolvedValue(existing)
    ;(mockPattern.count as jest.Mock).mockResolvedValue(MAX_PATTERNS_PER_TEAMMATE)
    ;(mockPattern.delete as jest.Mock).mockResolvedValue({})
    ;(mockPattern.create as jest.Mock).mockResolvedValue({})

    const newPattern = {
      description: 'New unique pattern.',
      severity: 'ACTION_REQUIRED',
      evidence: { meetingIds: ['m1', 'm2'], dates: [], tags: ['unique-tag-x'] },
    }
    const client = makeMockClient(JSON.stringify([newPattern]))

    await detectPatterns('tm-1', 'mgr-1', client)

    // Should evict oldest INFORMATIONAL pattern (p0)
    expect(mockPattern.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p0' } }))
    expect(mockPattern.create).toHaveBeenCalled()
  })
})
