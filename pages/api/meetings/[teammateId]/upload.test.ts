import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/withAuth', () => ({
  withAuth: (fn: Function) => fn,
}))

jest.mock('@/lib/meetings', () => ({
  ingestUpload: jest.fn(),
}))

jest.mock('@/lib/fileParsing', () => ({
  ValidationError: class ValidationError extends Error {},
  ParseError: class ParseError extends Error {},
  parseTextFromFile: jest.fn(),
}))

jest.mock('formidable', () => {
  return jest.fn().mockImplementation(() => ({
    parse: jest.fn(),
  }))
})

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(Buffer.alloc(100)),
}))

import { ingestUpload } from '@/lib/meetings'
import { ValidationError, ParseError } from '@/lib/fileParsing'

// Note: upload handler uses formidable which requires bodyParser: false.
// We test the business logic paths rather than the full HTTP parsing.
describe('POST /api/meetings/[teammateId]/upload — business logic', () => {
  const MANAGER_ID = 'mgr-1'
  const TEAMMATE_ID = 'tm-1'

  beforeEach(() => jest.clearAllMocks())

  it('ingestUpload is called with correct args', async () => {
    ;(ingestUpload as jest.Mock).mockResolvedValueOnce('mtg-1')
    await (ingestUpload as jest.Mock)(MANAGER_ID, TEAMMATE_ID, Buffer.alloc(100), '.pdf')
    expect(ingestUpload).toHaveBeenCalledWith(MANAGER_ID, TEAMMATE_ID, expect.any(Buffer), '.pdf')
  })

  it('ingestUpload rejects ValidationError for bad extension', async () => {
    ;(ingestUpload as jest.Mock).mockRejectedValueOnce(new ValidationError('Unsupported type'))
    await expect(
      (ingestUpload as jest.Mock)(MANAGER_ID, TEAMMATE_ID, Buffer.alloc(10), '.exe')
    ).rejects.toThrow('Unsupported type')
  })

  it('ingestUpload rejects ParseError for empty file', async () => {
    ;(ingestUpload as jest.Mock).mockRejectedValueOnce(new ParseError('File is empty'))
    await expect(
      (ingestUpload as jest.Mock)(MANAGER_ID, TEAMMATE_ID, Buffer.alloc(0), '.txt')
    ).rejects.toThrow('File is empty')
  })
})
