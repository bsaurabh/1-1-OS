import { parseTextFromFile, ValidationError, ParseError } from './fileParsing'

jest.mock('mammoth', () => ({
  extractRawText: jest.fn(),
}))

jest.mock('pdf-parse', () => jest.fn())

import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

const mockMammoth = mammoth as jest.Mocked<typeof mammoth>
const mockPdfParse = pdfParse as jest.MockedFunction<typeof pdfParse>

describe('parseTextFromFile', () => {
  const sampleText = 'This is sample meeting text for testing purposes.'

  describe('.txt files', () => {
    it('returns text from buffer', async () => {
      const buffer = Buffer.from(sampleText, 'utf-8')
      const result = await parseTextFromFile(buffer, '.txt')
      expect(result).toBe(sampleText)
    })

    it('throws ParseError for empty .txt file', async () => {
      const buffer = Buffer.from('   ', 'utf-8')
      await expect(parseTextFromFile(buffer, '.txt')).rejects.toThrow(ParseError)
    })
  })

  describe('.docx files', () => {
    it('returns extracted text from .docx', async () => {
      ;(mockMammoth.extractRawText as jest.Mock).mockResolvedValueOnce({ value: sampleText })
      const buffer = Buffer.alloc(100)
      const result = await parseTextFromFile(buffer, '.docx')
      expect(result).toBe(sampleText)
    })

    it('throws ParseError when mammoth fails', async () => {
      ;(mockMammoth.extractRawText as jest.Mock).mockRejectedValueOnce(new Error('corrupt file'))
      await expect(parseTextFromFile(Buffer.alloc(10), '.docx')).rejects.toThrow(ParseError)
    })

    it('throws ParseError when extracted text is empty', async () => {
      ;(mockMammoth.extractRawText as jest.Mock).mockResolvedValueOnce({ value: '' })
      await expect(parseTextFromFile(Buffer.alloc(10), '.docx')).rejects.toThrow(ParseError)
    })
  })

  describe('.pdf files', () => {
    it('returns extracted text from .pdf', async () => {
      mockPdfParse.mockResolvedValueOnce({ text: sampleText } as Awaited<ReturnType<typeof pdfParse>>)
      const buffer = Buffer.alloc(100)
      const result = await parseTextFromFile(buffer, '.pdf')
      expect(result).toBe(sampleText)
    })

    it('throws ParseError when pdf-parse fails', async () => {
      mockPdfParse.mockRejectedValueOnce(new Error('invalid pdf'))
      await expect(parseTextFromFile(Buffer.alloc(10), '.pdf')).rejects.toThrow(ParseError)
    })
  })

  describe('unsupported extensions', () => {
    it('throws ValidationError for .mp3', async () => {
      await expect(parseTextFromFile(Buffer.alloc(10), '.mp3')).rejects.toThrow(ValidationError)
    })

    it('throws ValidationError for .xlsx', async () => {
      await expect(parseTextFromFile(Buffer.alloc(10), '.xlsx')).rejects.toThrow(ValidationError)
    })

    it('includes allowed types in error message', async () => {
      try {
        await parseTextFromFile(Buffer.alloc(10), '.doc')
      } catch (err) {
        expect((err as Error).message).toContain('.txt')
        expect((err as Error).message).toContain('.docx')
        expect((err as Error).message).toContain('.pdf')
      }
    })
  })
})
