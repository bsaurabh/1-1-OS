import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

const SUPPORTED_EXTENSIONS = ['.txt', '.docx', '.pdf'] as const
type SupportedExtension = typeof SUPPORTED_EXTENSIONS[number]

export async function parseTextFromFile(
  buffer: Buffer,
  extension: string
): Promise<string> {
  const ext = extension.toLowerCase() as SupportedExtension

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new ValidationError(
      `Unsupported file type "${extension}". Allowed: .txt, .docx, .pdf`
    )
  }

  let text: string

  if (ext === '.txt') {
    text = buffer.toString('utf-8')
  } else if (ext === '.docx') {
    try {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } catch (err) {
      throw new ParseError(`Failed to parse .docx file: ${(err as Error).message}`)
    }
  } else {
    // .pdf
    try {
      const result = await pdfParse(buffer)
      text = result.text
    } catch (err) {
      throw new ParseError(`Failed to parse .pdf file: ${(err as Error).message}`)
    }
  }

  if (!text || text.trim().length === 0) {
    throw new ParseError('File appears to be empty or contains no extractable text')
  }

  return text
}
