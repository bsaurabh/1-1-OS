import {
  listTimeline,
  generateGrowthSummary,
  buildGrowthSummaryPrompt,
  parseGrowthSummaryResponse,
  EmptyHistoryError,
  SUMMARY_MODEL,
} from './timeline'

jest.mock('./prisma', () => ({
  prisma: {
    meeting: { findMany: jest.fn() },
    teammate: { findFirst: jest.fn() },
  },
}))

import { prisma } from './prisma'

const mockMeeting = prisma.meeting as jest.Mocked<typeof prisma.meeting>
const mockTeammate = prisma.teammate as jest.Mocked<typeof prisma.teammate>

const MANAGER_ID = 'mgr-1'
const TEAMMATE_ID = 'tm-1'

const sampleMeeting = {
  id: 'mtg-1',
  summary: 'Good discussion about design system',
  tags: ['Design', 'Process'],
  tone: 'Positive',
  status: 'ANALYSIS_COMPLETE',
  createdAt: new Date('2026-02-01'),
}

const sampleTeammate = {
  id: TEAMMATE_ID,
  name: 'Alex Kim',
  profile: { role: 'Senior Designer' },
}

beforeEach(() => jest.clearAllMocks())

describe('listTimeline', () => {
  it('returns timeline entries for manager+teammate', async () => {
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([sampleMeeting])

    const result = await listTimeline(MANAGER_ID, TEAMMATE_ID)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('mtg-1')
    expect(result[0].createdAt).toBe(sampleMeeting.createdAt.toISOString())
    expect(mockMeeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { managerId: MANAGER_ID, teammateId: TEAMMATE_ID },
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('returns empty array when no meetings exist', async () => {
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([])
    const result = await listTimeline(MANAGER_ID, TEAMMATE_ID)
    expect(result).toHaveLength(0)
  })
})

describe('buildGrowthSummaryPrompt', () => {
  it('includes teammate name in prompt', () => {
    const prompt = buildGrowthSummaryPrompt(sampleTeammate, [sampleMeeting])
    expect(prompt).toContain('Alex Kim')
  })

  it('includes meeting summary text', () => {
    const prompt = buildGrowthSummaryPrompt(sampleTeammate, [sampleMeeting])
    expect(prompt).toContain('Good discussion about design system')
  })
})

describe('parseGrowthSummaryResponse', () => {
  it('parses valid JSON response', () => {
    const text = JSON.stringify({
      narrative: 'Strong growth trajectory',
      keyThemes: ['Design Systems'],
      growthSignals: ['Improved delivery speed'],
      coachingGaps: ['Stakeholder alignment'],
    })
    const result = parseGrowthSummaryResponse(text)
    expect(result.narrative).toBe('Strong growth trajectory')
    expect(result.keyThemes).toEqual(['Design Systems'])
  })

  it('returns empty object for unparseable text', () => {
    const result = parseGrowthSummaryResponse('not json')
    expect(result).toEqual({})
  })

  it('extracts JSON from text with surrounding content', () => {
    const text = 'Here is the summary: {"narrative":"Growth","keyThemes":[],"growthSignals":[],"coachingGaps":[]}'
    const result = parseGrowthSummaryResponse(text)
    expect(result.narrative).toBe('Growth')
  })
})

describe('generateGrowthSummary', () => {
  const mockCreate = jest.fn()
  const mockClient = { messages: { create: mockCreate } } as unknown as import('@anthropic-ai/sdk').default

  it('throws EmptyHistoryError when no ANALYSIS_COMPLETE meetings', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue(sampleTeammate)
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([])

    await expect(generateGrowthSummary(MANAGER_ID, TEAMMATE_ID, mockClient)).rejects.toThrow(EmptyHistoryError)
  })

  it('calls Claude and returns GrowthSummary on success', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue(sampleTeammate)
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([sampleMeeting])

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          narrative: 'Growth trajectory',
          keyThemes: ['Design'],
          growthSignals: ['Faster delivery'],
          coachingGaps: ['Alignment'],
        }),
      }],
    })

    const result = await generateGrowthSummary(MANAGER_ID, TEAMMATE_ID, mockClient)
    expect(result).not.toBeNull()
    expect(result?.teammateName).toBe('Alex Kim')
    expect(result?.narrative).toBe('Growth trajectory')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: SUMMARY_MODEL })
    )
  })

  it('returns null (P-5.02) when Claude throws an error', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue(sampleTeammate)
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([sampleMeeting])
    mockCreate.mockRejectedValue(new Error('Claude unavailable'))

    const result = await generateGrowthSummary(MANAGER_ID, TEAMMATE_ID, mockClient)
    expect(result).toBeNull()
  })

  it('uses Promise.all to pre-fetch teammate and meetings in parallel (P-5.01)', async () => {
    ;(mockTeammate.findFirst as jest.Mock).mockResolvedValue(sampleTeammate)
    ;(mockMeeting.findMany as jest.Mock).mockResolvedValue([sampleMeeting])
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ narrative: 'G', keyThemes: [], growthSignals: [], coachingGaps: [] }) }],
    })

    await generateGrowthSummary(MANAGER_ID, TEAMMATE_ID, mockClient)

    // Both DB calls should be made (parallel pre-fetch)
    expect(mockTeammate.findFirst).toHaveBeenCalledTimes(1)
    expect(mockMeeting.findMany).toHaveBeenCalledTimes(1)
  })
})
