import {
  buildAnalysisPrompt,
  parseAnalysisResponse,
  analyze,
  AnalysisParseError,
} from './meetingAnalysisHandler'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    meeting: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('@/lib/commitments', () => ({
  saveSuggested: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { saveSuggested } from '@/lib/commitments'
import Anthropic from '@anthropic-ai/sdk'

const mockMeeting = prisma.meeting as jest.Mocked<typeof prisma.meeting>

describe('buildAnalysisPrompt', () => {
  it('includes raw text and teammate name', () => {
    const prompt = buildAnalysisPrompt('We discussed goals.', 'Alice')
    expect(prompt).toContain('We discussed goals.')
    expect(prompt).toContain('Alice')
  })

  it('includes allowed tags list', () => {
    const prompt = buildAnalysisPrompt('text', 'Bob')
    expect(prompt).toContain('alignment')
    expect(prompt).toContain('performance')
  })

  it('requires JSON-only output', () => {
    const prompt = buildAnalysisPrompt('text', 'Bob')
    expect(prompt).toContain('Return ONLY valid JSON')
  })
})

describe('parseAnalysisResponse', () => {
  const validResponse = JSON.stringify({
    summary: 'Good meeting.',
    tone: 'productive',
    themes: ['goal setting', 'performance'],
    tags: ['goal', 'performance'],
    commitments: [{ text: 'Follow up on Q2 OKRs', owner: 'MANAGER' }],
  })

  it('parses valid JSON response', () => {
    const result = parseAnalysisResponse(validResponse)
    expect(result.summary).toBe('Good meeting.')
    expect(result.tone).toBe('productive')
    expect(result.themes).toHaveLength(2)
    expect(result.tags).toContain('goal')
    expect(result.commitments).toHaveLength(1)
  })

  it('extracts JSON from text with surrounding prose (regex fallback)', () => {
    const withProse = `Here is the analysis:\n${validResponse}\nLet me know if you need more.`
    const result = parseAnalysisResponse(withProse)
    expect(result.summary).toBe('Good meeting.')
  })

  it('filters out invalid tags', () => {
    const withBadTags = JSON.stringify({
      summary: 'Test',
      tone: 'neutral',
      themes: [],
      tags: ['goal', 'invalid-tag', 'performance'],
      commitments: [],
    })
    const result = parseAnalysisResponse(withBadTags)
    expect(result.tags).toContain('goal')
    expect(result.tags).not.toContain('invalid-tag')
  })

  it('throws AnalysisParseError for unparseable input', () => {
    expect(() => parseAnalysisResponse('not json at all')).toThrow(AnalysisParseError)
  })

  it('handles missing commitment owner gracefully', () => {
    const withBadOwner = JSON.stringify({
      summary: 'Test',
      tone: 'neutral',
      themes: [],
      tags: [],
      commitments: [{ text: 'Do something', owner: 'INVALID' }],
    })
    const result = parseAnalysisResponse(withBadOwner)
    expect(result.commitments).toHaveLength(0)
  })
})

describe('analyze', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws if meeting not found', async () => {
    ;(mockMeeting.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(analyze('missing-id')).rejects.toThrow('not found')
  })

  it('calls Claude and updates meeting on success', async () => {
    ;(mockMeeting.findUnique as jest.Mock).mockResolvedValue({
      id: 'mtg-1',
      rawText: 'We had a productive discussion about Q2 OKRs and design system priorities.',
      teammate: { name: 'Alice', managerId: 'mgr-1', id: 'tm-1' },
    })
    ;(mockMeeting.update as jest.Mock).mockResolvedValue({})
    ;(saveSuggested as jest.Mock).mockResolvedValue(undefined)

    const mockClient = {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                summary: 'Good meeting about goals.',
                tone: 'productive',
                themes: ['goal setting'],
                tags: ['goal'],
                commitments: [{ text: 'Review OKRs next week', owner: 'MANAGER' }],
              }),
            },
          ],
        }),
      },
    } as unknown as Anthropic

    await analyze('mtg-1', mockClient)

    expect(mockMeeting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ANALYSIS_COMPLETE' }),
      })
    )
    expect(saveSuggested).toHaveBeenCalled()
  })

  it('throws when Claude call fails', async () => {
    ;(mockMeeting.findUnique as jest.Mock).mockResolvedValue({
      id: 'mtg-1',
      rawText: 'Some notes.',
      teammate: { name: 'Bob', managerId: 'mgr-1', id: 'tm-1' },
    })

    const mockClient = {
      messages: {
        create: jest.fn().mockRejectedValue(new Error('API error')),
      },
    } as unknown as Anthropic

    await expect(analyze('mtg-1', mockClient)).rejects.toThrow()
  })
})
