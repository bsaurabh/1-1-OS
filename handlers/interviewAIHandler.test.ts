import Anthropic from '@anthropic-ai/sdk'
import {
  nextQuestion,
  generateProfile,
  ProfileArea,
  type ConversationTurn,
} from './interviewAIHandler'

// ─── Mock Anthropic client ────────────────────────────────────────────────────

function makeMessage(text: string): Anthropic.Message {
  return {
    id:           'msg_test',
    type:         'message',
    role:         'assistant',
    content:      [{ type: 'text', text, citations: null }],
    model:        'claude-haiku-4-5-20251001',
    stop_reason:  'end_turn',
    stop_sequence: null,
    usage:        { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: null, cache_read_input_tokens: null },
  }
}

function makeMockClient(responseText: string): Anthropic {
  return {
    messages: {
      create: jest.fn().mockResolvedValue(makeMessage(responseText)),
    },
  } as unknown as Anthropic
}

function makeTurn(index: number, area: ProfileArea, answer: string): ConversationTurn {
  return {
    questionIndex: index,
    area,
    question:      `Question about ${area}?`,
    answer,
  }
}

// ─── nextQuestion ─────────────────────────────────────────────────────────────

describe('nextQuestion', () => {
  it('returns Q1 on empty history', async () => {
    const client = makeMockClient("What are their key strengths?")
    const result = await nextQuestion('Chirag', 'Designer', [], '', client)

    expect(result.questionIndex).toBe(1)
    expect(result.area).toBe(ProfileArea.STRENGTHS)
    expect(result.question).toBe("What are their key strengths?")
    expect(result.isComplete).toBe(false)
  })

  it('returns Q2 when history has 1 turn', async () => {
    const client = makeMockClient("Where do they want to grow?")
    const history = [makeTurn(1, ProfileArea.STRENGTHS, 'Great at systems thinking')]
    const result = await nextQuestion('Chirag', 'Designer', history, 'Great at systems thinking', client)

    expect(result.questionIndex).toBe(2)
    expect(result.area).toBe(ProfileArea.GROWTH_AREAS)
    expect(result.isComplete).toBe(false)
  })

  it('returns isComplete: true when 7 turns already answered', async () => {
    const history: ConversationTurn[] = [
      makeTurn(1, ProfileArea.STRENGTHS,             'answer'),
      makeTurn(2, ProfileArea.GROWTH_AREAS,          'answer'),
      makeTurn(3, ProfileArea.ASPIRATIONS,           'answer'),
      makeTurn(4, ProfileArea.KPIS,                  'answer'),
      makeTurn(5, ProfileArea.BEHAVIORAL_TENDENCIES, 'answer'),
      makeTurn(6, ProfileArea.FEEDBACK_STYLE,        'answer'),
      makeTurn(7, ProfileArea.MOTIVATION_DRIVERS,    'answer'),
    ]
    const client = makeMockClient('')
    const result = await nextQuestion('Chirag', 'Designer', history, 'answer', client)

    expect(result.isComplete).toBe(true)
    expect((client.messages.create as jest.Mock)).not.toHaveBeenCalled()
  })

  it('retries once on transient error then succeeds', async () => {
    const mockCreate = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Anthropic.APIError(529, undefined, 'overloaded', undefined), { status: 529 }))
      .mockResolvedValueOnce(makeMessage('What are their strengths?'))

    const client = { messages: { create: mockCreate } } as unknown as Anthropic
    const result = await nextQuestion('Chirag', 'Designer', [], '', client)

    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(result.question).toBe('What are their strengths?')
  })

  it('throws after exhausting retries on transient error', async () => {
    const error = Object.assign(new Anthropic.APIError(529, undefined, 'overloaded', undefined), { status: 529 })
    const client = {
      messages: { create: jest.fn().mockRejectedValue(error) },
    } as unknown as Anthropic

    await expect(nextQuestion('Chirag', 'Designer', [], '', client)).rejects.toThrow()
  })
})

// ─── generateProfile ──────────────────────────────────────────────────────────

describe('generateProfile', () => {
  const fullHistory: ConversationTurn[] = [
    makeTurn(1, ProfileArea.STRENGTHS,             'Systems thinking'),
    makeTurn(2, ProfileArea.GROWTH_AREAS,          'Communication'),
    makeTurn(3, ProfileArea.ASPIRATIONS,           'Lead design team'),
    makeTurn(4, ProfileArea.KPIS,                  'NPS, delivery velocity'),
    makeTurn(5, ProfileArea.BEHAVIORAL_TENDENCIES, 'Introvert, detail-oriented'),
    makeTurn(6, ProfileArea.FEEDBACK_STYLE,        'Direct and specific'),
    makeTurn(7, ProfileArea.MOTIVATION_DRIVERS,    'Craft and impact'),
  ]

  it('returns parsed profile on valid JSON response', async () => {
    const profile = {
      strengths:            'Shows strong systems thinking.',
      growthAreas:          'Needs to improve communication.',
      aspirations:          'Aims to lead a design team.',
      kpis:                 'Owns NPS and delivery velocity.',
      behavioralTendencies: 'Introvert, highly detail-oriented.',
      feedbackStyle:        'Prefers direct and specific feedback.',
      motivationDrivers:    'Driven by craft and impact.',
    }
    const client = makeMockClient(JSON.stringify(profile))
    const result = await generateProfile('Chirag', 'Designer', fullHistory, client)

    expect(result.profile).toEqual(profile)
    expect(result.warning).toBeUndefined()
  })

  it('extracts JSON from response with surrounding text', async () => {
    const profile = { strengths: 'Great', growthAreas: 'Needs work' }
    const text = `Here is the profile:\n${JSON.stringify(profile)}\nHope this helps!`
    const client = makeMockClient(text)
    const result = await generateProfile('Chirag', 'Designer', fullHistory, client)

    expect(result.profile.strengths).toBe('Great')
  })

  it('returns _rawAnswers fallback on unparseable JSON', async () => {
    const client = makeMockClient('This is not JSON at all.')
    const result = await generateProfile('Chirag', 'Designer', fullHistory, client)

    expect(result.profile._rawAnswers).toEqual(fullHistory)
    expect(result.warning).toContain('auto-fill failed')
  })
})
