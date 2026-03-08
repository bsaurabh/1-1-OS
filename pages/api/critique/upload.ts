import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'

export const config = { api: { bodyParser: false } }

const BUCKET = 'critique-uploads'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

function getStorageClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureBucket(supabase: any) {
  const { data } = await supabase.storage.getBucket(BUCKET)
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
    if (error && !error.message.includes('already exists')) {
      console.error('[critique-upload] bucket creation failed:', error)
    }
  }
}

export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  managerId: string
) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed')
  }

  const form = formidable({ maxFileSize: MAX_FILE_SIZE, maxFiles: 10 })

  let fields: formidable.Fields
  let files: formidable.Files
  try {
    ;[fields, files] = await form.parse(req)
    void fields
  } catch (err) {
    console.error('[critique-upload] parse error:', err)
    return sendError(res, 400, 'File upload failed. Max 10MB per file.')
  }

  const fileList = files.images
  if (!fileList || fileList.length === 0) {
    return sendError(res, 400, 'No images provided. Use field name "images".')
  }

  const supabase = getStorageClient()
  await ensureBucket(supabase)
  const uploadedUrls: string[] = []

  for (const file of fileList) {
    if (!ALLOWED_TYPES.includes(file.mimetype || '')) {
      return sendError(res, 400, `Unsupported file type: ${file.mimetype}. Use PNG, JPEG, WebP, or GIF.`)
    }

    const ext = path.extname(file.originalFilename || '.png')
    const storagePath = `${managerId}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`

    const buffer = fs.readFileSync(file.filepath)

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.mimetype || 'image/png',
        upsert: false,
      })

    if (error) {
      console.error('[critique-upload] supabase error:', error)
      return sendError(res, 500, INTERNAL_ERROR)
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    uploadedUrls.push(publicData.publicUrl)

    // Clean up temp file
    try { fs.unlinkSync(file.filepath) } catch { /* ignore */ }
  }

  return res.status(200).json({ imageUrls: uploadedUrls })
})
