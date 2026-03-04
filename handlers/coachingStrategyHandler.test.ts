import Anthropic from '@anthropic-ai/sdk'
import {
  parseFrameworkResponse,
  fallbackApproach,
  selectFramework,
  buildFrameworkSelectionPrompt,
  FRAMEWORK_MODEL,
  VALID_FRAMEWORKS,
} from './coachingStrategyHandler'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMessage(text: string): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text, citations: null }],
    model: FRAMEWORK_MODEL,
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

const validApproach = {
  framework: 'GROW',
  rationale: 'The teammate is working on clear goal-setting. GROW helps structure the conversation.',
  actions: ['Ask what their goal is for Q2.', 'Explore what obstacles exist.'],
}

// ─── parseFrameworkResponse ───────────────────────────────────────────────────

describe('parseFrameworkResponse', () => {
  it('returns CoachingApproach for valid JSON with valid framework', () => {
    const result = parseFrameworkResponse(JSON.stringify(validApproach))
    expect(result).not.toBeNull()
    expect(result!.framework).toBe('GROW')
    expect(result!.rationale).toContain('goal-setting')
    expect(result!.actions).toHaveLength(2)
  })

  it('returns valid approach for all valid frameworks', () => {
    for (const fw of VALID_FRAMEWORKS) {
      const result = parseFrameworkResponse(
        JSON.stringify({ ...validApproach, framework: fw })
      )
      expect(result).not.toBeNull()
      expect(result!.framework).toBe(fw)
    }
  })

  it('returns null for unknown framework', () => {
    const result = parseFrameworkResponse(
      JSON.stringify({ ...validApproach, framework: 'UNKNOWN' })
    )
    expect(result).toBeNull()
  })

  it('returns null for missing rationale', () => {
    const result = parseFrameworkResponse(
      JSON.stringify({ framework: 'GROW', rationale: '', actions: [] })
    )
    expect(result).toBeNull()
  })

  it('returns null for completely unparseable input', () => {
    expect(parseFrameworkResponse('not json')).toBeNull()
  })

  it('extracts JSON from text with surrounding prose (regex fallback)', () => {
    const withProse = `Here is my recommendation:\n${JSON.stringify(validApproach)}\nHope this helps.`
    const result = parseFrameworkResponse(withProse)
    expect(result).not.toBeNull()
    expect(result!.framework).toBe('GROW')
  })

  it('returns empty actions array when actions are missing from response', () => {
    const withoutActions = { framework: 'SBI', rationale: 'Good for feedback.', actions: [] }
    const result = parseFrameworkResponse(JSON.stringify(withoutActions))
    expect(result).not.toBeNull()
    expect(result!.actions).toHaveLength(0)
  })
})

// ─── fallbackApproach ─────────────────────────────────────────────────────────

describe('fallbackApproach', () => {
  it('returns a CoachingApproach object', () => {
    const result = fallbackApproach()
    expect(result).toHaveProperty('framework')
    expect(result).toHaveProperty('rationale')
    expect(result).toHaveProperty('actions')
    expect(Array.isArray(result.actions)).toBe(true)
  })

  it('uses General as framework', () => {
    expect(fallbackApproach().framework).toBe('General')
  })

  it('includes at least one action', () => {
    expect(fallbackApproach().actions.length).toBeGreaterThan(0)
  })

  it('includes rationale about open-ended questions', () => {
    const result = fallbackApproach()
    expect(result.rationale.toLowerCase()).toContain('open-ended')
  })
})

// ─── buildFrameworkSelectionPrompt ────────────────────────────────────────────

describe('buildFrameworkSelectionPrompt', () => {
  it('includes teammate name', () => {
    const prompt = buildFrameworkSelectionPrompt('Alice', {}, [], [])
    expect(prompt).toContain('Alice')
  })

  it('includes all valid frameworks', () => {
    const prompt = buildFrameworkSelectionPrompt('Bob', {}, [], [])
    for (const fw of VALID_FRAMEWORKS) {
      expect(prompt).toContain(fw)
    }
  })

  it('includes pattern severity and description', () => {
    const patterns = [{ severity: 'WATCH', description: 'Missed deadlines repeatedly.' }]
    const prompt = buildFrameworkSelectionPrompt('Carol', {}, patterns, [])
    expect(prompt).toContain('WATCH')
    expect(prompt).toContain('Missed deadlines repeatedly.')
  })

  it('includes carried commitment count', () => {
    const commitments = [{ carryCount: 3 }, { carryCount: 1 }, { carryCount: 2 }]
    const prompt = buildFrameworkSelectionPrompt('Dan', {}, [], commitments)
    // 2 commitments have carryCount >= 2
    expect(prompt).toContain('2')
  })

  it('requires JSON-only output', () => {
    const prompt = buildFrameworkSelectionPrompt('Eve', {}, [], [])
    expect(prompt).toContain('Return ONLY valid JSON')
  })
})

// ─── selectFramework ──────────────────────────────────────────────────────────

describe('selectFramework', () => {
  const teammate = { name: 'Alice', profile: { strengths: 'Systems thinking' } }
  const patterns = [{ severity: 'WATCH', description: 'Avoids conflict.' }]
  const commitments = [{ carryCount: 0 }]

  it('returns parsed CoachingApproach on success', async () => {
    const client = makeMockClient(JSON.stringify(validApproach))
    const result = await selectFramework(teammate, patterns, commitments, client)
    expect(result.framework).toBe('GROW')
    expect(result.rationale).toBeTruthy()
  })

  it('returns fallbackApproach when Claude returns invalid framework', async () => {
    const invalid = { ...validApproach, framework: 'INVALID' }
    const client = makeMockClient(JSON.stringify(invalid))
    const result = await selectFramework(teammate, patterns, commitments, client)
    expect(result.framework).toBe('General')
  })

  it('returns fallbackApproach when Claude call throws', async () => {
    const client = {
      messages: {
        create: jest.fn().mockRejectedValue(new Error('API error')),
      },
    } as unknown as Anthropic

    const result = await selectFramework(teammate, patterns, commitments, client)
    expect(result.framework).toBe('General')
  })

  it('returns fallbackApproach when Claude returns unparseable response', async () => {
    const client = makeMockClient('I cannot determine the framework right now.')
    const result = await selectFramework(teammate, patterns, commitments, client)
    expect(result.framework).toBe('General')
  })
})
