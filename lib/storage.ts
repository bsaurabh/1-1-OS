import { createClient } from '@supabase/supabase-js'

const BUCKET = 'voice-recordings'

function getStorageClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

export async function createPresignedUploadUrl(path: string): Promise<string> {
  const supabase = getStorageClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) throw new Error(`Failed to create presigned upload URL: ${error?.message}`)
  return data.signedUrl
}

export async function downloadFile(path: string): Promise<Buffer> {
  const supabase = getStorageClient()
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(`Failed to download file: ${error?.message}`)
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function deleteFile(path: string): Promise<void> {
  try {
    const supabase = getStorageClient()
    await supabase.storage.from(BUCKET).remove([path])
  } catch {
    // silent — orphaned audio is acceptable technical debt (TD-11)
  }
}
