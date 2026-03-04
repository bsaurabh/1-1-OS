import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import { withAuth } from '@/lib/withAuth'
import { ingestUpload } from '@/lib/meetings'
import { sendError } from '@/lib/apiError'
import { ValidationError, ParseError } from '@/lib/fileParsing'

export const config = {
  api: { bodyParser: false },
}

const ALLOWED_EXTENSIONS = ['.txt', '.docx', '.pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

async function handler(req: NextApiRequest, res: NextApiResponse, managerId: string) {
  if (req.method !== 'POST') return sendError(res, 405 as never, 'Method not allowed')

  const teammateId = req.query.teammateId as string

  const form = formidable({ maxFiles: 1, maxFileSize: MAX_FILE_SIZE })

  let file: formidable.File
  try {
    const [, files] = await form.parse(req)
    const fileList = files.file
    if (!fileList || fileList.length === 0) {
      return sendError(res, 400, 'No file provided')
    }
    file = fileList[0]
  } catch {
    return sendError(res, 400, 'File too large or invalid upload (max 10MB)')
  }

  const ext = path.extname(file.originalFilename ?? '').toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return sendError(res, 400, `Unsupported file type "${ext}". Allowed: .txt, .docx, .pdf`)
  }

  const buffer = fs.readFileSync(file.filepath)

  try {
    const meetingId = await ingestUpload(managerId, teammateId, buffer, ext)
    return res.status(200).json({ meetingId })
  } catch (err) {
    if (err instanceof ValidationError) return sendError(res, 400, err.message)
    if (err instanceof ParseError) return sendError(res, 422, err.message)
    const message = (err as Error).message
    if (message === 'Teammate not found') return sendError(res, 404, message)
    console.error('[upload] error:', err)
    return sendError(res, 500, 'Something went wrong. Please try again.')
  }
}

export default withAuth(handler)
