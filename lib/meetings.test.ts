import { ingestPaste, ingestUpload, ingestTranscription } from './meetings'

jest.mock('./prisma', () => ({
  prisma: {
    teammate: { findFirst: jest.fn() },
    meeting: { create: jest.fn() },
    analysisJob: { create: jest.fn() },
  },
}))

jest.mock('./fileParsing', () => ({
  ...jest.requireActual('./fileParsing'),
  parseTextFromFile: jest.fn(),
}))

import { prisma } from './prisma'
import { parseTextFromFile } from './fileParsing'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockParseText = parseTextFromFile as jest.MockedFunction<typeof parseTextFromFile>

const MANAGER_ID = 'mgr-1'
const TEAMMATE_ID = 'tm-1'
const MEETING_ID = 'mtg-1'

function mockTeammateFound() {
  ;(mockPrisma.teammate.findFirst as jest.Mock).mockResolvedValue({ id: TEAMMATE_ID })
}

function mockTeammateNotFound() {
  ;(mockPrisma.teammate.findFirst as jest.Mock).mockResolvedValue(null)
}

function mockMeetingCreate() {
  ;(mockPrisma.meeting.create as jest.Mock).mockResolvedValue({ id: MEETING_ID })
  ;(mockPrisma.analysisJob.create as jest.Mock).mockResolvedValue({ id: 'job-1' })
}

describe('ingestPaste', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws if text is less than 50 chars', async () => {
    await expect(ingestPaste(MANAGER_ID, TEAMMATE_ID, 'short')).rejects.toThrow(
      'at least 50 characters'
    )
  })

  it('throws if teammate not found', async () => {
    mockTeammateNotFound()
    const text = 'A'.repeat(60)
    await expect(ingestPaste(MANAGER_ID, TEAMMATE_ID, text)).rejects.toThrow('Teammate not found')
  })

  it('returns meetingId on success', async () => {
    mockTeammateFound()
    mockMeetingCreate()
    const text = 'A'.repeat(60)
    const result = await ingestPaste(MANAGER_ID, TEAMMATE_ID, text)
    expect(result).toBe(MEETING_ID)
    expect(mockPrisma.meeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'PASTE', status: 'PENDING_ANALYSIS' }),
      })
    )
  })
})

describe('ingestUpload', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws if teammate not found', async () => {
    mockTeammateNotFound()
    await expect(
      ingestUpload(MANAGER_ID, TEAMMATE_ID, Buffer.alloc(10), '.pdf')
    ).rejects.toThrow('Teammate not found')
  })

  it('delegates to parseTextFromFile and creates meeting', async () => {
    mockTeammateFound()
    mockMeetingCreate()
    mockParseText.mockResolvedValueOnce('Extracted meeting text that is long enough for analysis.')

    const result = await ingestUpload(MANAGER_ID, TEAMMATE_ID, Buffer.alloc(10), '.pdf')
    expect(result).toBe(MEETING_ID)
    expect(mockParseText).toHaveBeenCalledWith(expect.any(Buffer), '.pdf')
    expect(mockPrisma.meeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'UPLOAD' }),
      })
    )
  })

  it('re-throws ParseError from fileParsing', async () => {
    mockTeammateFound()
    const { ParseError } = await import('./fileParsing')
    mockParseText.mockRejectedValueOnce(new ParseError('empty file'))
    await expect(
      ingestUpload(MANAGER_ID, TEAMMATE_ID, Buffer.alloc(10), '.txt')
    ).rejects.toThrow('empty file')
  })
})

describe('ingestTranscription', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws if text is empty', async () => {
    await expect(ingestTranscription(MANAGER_ID, TEAMMATE_ID, '  ')).rejects.toThrow(
      'cannot be empty'
    )
  })

  it('throws if teammate not found', async () => {
    mockTeammateNotFound()
    await expect(
      ingestTranscription(MANAGER_ID, TEAMMATE_ID, 'some transcription text')
    ).rejects.toThrow('Teammate not found')
  })

  it('returns meetingId with VOICE source', async () => {
    mockTeammateFound()
    mockMeetingCreate()
    const result = await ingestTranscription(MANAGER_ID, TEAMMATE_ID, 'transcription text here')
    expect(result).toBe(MEETING_ID)
    expect(mockPrisma.meeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'VOICE' }),
      })
    )
  })
})
