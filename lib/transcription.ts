import { createId } from '@paralleldrive/cuid2'
import OpenAI from 'openai'
import { createPresignedUploadUrl, downloadFile, deleteFile } from '@/lib/storage'

function cuid() {
  // Fallback cuid implementation using crypto
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function getAudioUploadUrl(
  managerId: string
): Promise<{ uploadUrl: string; fileId: string }> {
  const fileId = cuid()
  const path = `${managerId}/${fileId}`
  const uploadUrl = await createPresignedUploadUrl(path)
  return { uploadUrl, fileId }
}

export async function transcribeAudio(
  managerId: string,
  fileId: string
): Promise<string> {
  const path = `${managerId}/${fileId}`

  const audioBuffer = await downloadFile(path)

  const openai = getOpenAIClient()

  // Convert buffer to File object for OpenAI API
  const file = new File([new Uint8Array(audioBuffer)], `${fileId}.webm`, { type: 'audio/webm' })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
  })

  // Delete audio after successful transcription (best-effort)
  await deleteFile(path)

  return transcription.text
}

export async function discardAudio(
  managerId: string,
  fileId: string
): Promise<void> {
  const path = `${managerId}/${fileId}`
  await deleteFile(path)
}
