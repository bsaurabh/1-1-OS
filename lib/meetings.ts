import { prisma } from '@/lib/prisma'
import { parseTextFromFile } from '@/lib/fileParsing'

const MIN_PASTE_LENGTH = 50

export async function ingestPaste(
  managerId: string,
  teammateId: string,
  text: string
): Promise<string> {
  if (!text || text.trim().length < MIN_PASTE_LENGTH) {
    throw new Error(`Meeting notes must be at least ${MIN_PASTE_LENGTH} characters`)
  }

  await verifyTeammateOwnership(managerId, teammateId)

  const meetingId = await saveMeetingAndEnqueue(managerId, teammateId, text.trim(), 'PASTE')
  return meetingId
}

export async function ingestUpload(
  managerId: string,
  teammateId: string,
  buffer: Buffer,
  extension: string
): Promise<string> {
  await verifyTeammateOwnership(managerId, teammateId)

  const text = await parseTextFromFile(buffer, extension)

  const meetingId = await saveMeetingAndEnqueue(managerId, teammateId, text, 'UPLOAD')
  return meetingId
}

export async function ingestTranscription(
  managerId: string,
  teammateId: string,
  text: string
): Promise<string> {
  if (!text || text.trim().length === 0) {
    throw new Error('Transcription text cannot be empty')
  }

  await verifyTeammateOwnership(managerId, teammateId)

  const meetingId = await saveMeetingAndEnqueue(managerId, teammateId, text.trim(), 'VOICE')
  return meetingId
}

async function verifyTeammateOwnership(
  managerId: string,
  teammateId: string
): Promise<void> {
  const teammate = await prisma.teammate.findFirst({
    where: { id: teammateId, managerId },
    select: { id: true },
  })
  if (!teammate) {
    throw new Error('Teammate not found')
  }
}

async function saveMeetingAndEnqueue(
  managerId: string,
  teammateId: string,
  rawText: string,
  source: 'PASTE' | 'UPLOAD' | 'VOICE'
): Promise<string> {
  const meeting = await prisma.meeting.create({
    data: {
      managerId,
      teammateId,
      rawText,
      source,
      status: 'PENDING_ANALYSIS',
    },
    select: { id: true },
  })

  await prisma.analysisJob.create({
    data: {
      meetingId: meeting.id,
      status: 'PENDING',
      retryCount: 0,
    },
  })

  return meeting.id
}
