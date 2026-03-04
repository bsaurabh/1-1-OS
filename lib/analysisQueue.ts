import { prisma } from '@/lib/prisma'
import type { AnalysisJob } from '@prisma/client'

const MAX_RETRY_COUNT = 2

export async function enqueue(meetingId: string): Promise<void> {
  await prisma.analysisJob.create({
    data: { meetingId, status: 'PENDING', retryCount: 0 },
  })
}

export async function claimNextJob(): Promise<AnalysisJob | null> {
  // Atomic claim using FOR UPDATE SKIP LOCKED — prevents double-processing
  // when multiple cron invocations overlap
  const result = await prisma.$queryRaw<AnalysisJob[]>`
    UPDATE analysis_jobs
    SET status = 'PROCESSING'
    WHERE id = (
      SELECT id FROM analysis_jobs
      WHERE status = 'PENDING'
         OR (status = 'FAILED' AND "retryCount" < ${MAX_RETRY_COUNT})
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `
  return result[0] ?? null
}

export async function processNext(
  analyzeFn: (meetingId: string) => Promise<void>
): Promise<{ processed: number }> {
  const job = await claimNextJob()
  if (!job) return { processed: 0 }

  try {
    await analyzeFn(job.meetingId)
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETE', processedAt: new Date() },
    })
    return { processed: 1 }
  } catch (err) {
    await handleFailure(job, (err as Error).message)
    return { processed: 1 }
  }
}

export async function handleFailure(
  job: AnalysisJob,
  errorMessage: string
): Promise<void> {
  const newRetryCount = job.retryCount + 1
  const isPermanentFailure = newRetryCount > MAX_RETRY_COUNT

  await prisma.analysisJob.update({
    where: { id: job.id },
    data: {
      status: 'FAILED',
      retryCount: newRetryCount,
      error: errorMessage,
    },
  })

  if (isPermanentFailure) {
    await prisma.meeting.update({
      where: { id: job.meetingId },
      data: { status: 'ANALYSIS_FAILED' },
    })
  }
}
