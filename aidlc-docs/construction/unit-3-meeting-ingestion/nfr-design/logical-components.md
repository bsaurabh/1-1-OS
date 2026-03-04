# Logical Components — Unit 3: Meeting Ingestion

**Date**: 2026-03-02
**Unit**: Unit 3: Meeting Ingestion

---

## Component Overview

| ID | Component | File | Responsibility |
|----|-----------|------|---------------|
| LC-3.01 | MeetingIngestionService | `lib/meetings.ts` | All ingestion paths: paste, upload, voice; save Meeting + enqueue AnalysisJob |
| LC-3.02 | FileParsing Utility | `lib/fileParsing.ts` | Extract plain text from .txt/.docx/.pdf buffers |
| LC-3.03 | StorageService | `lib/storage.ts` | Supabase Storage client wrapper: presigned URL, download, delete |
| LC-3.04 | TranscriptionService | `lib/transcription.ts` | Audio lifecycle: presigned URL generation, Whisper transcription, discard |
| LC-3.05 | MeetingAnalysisHandler | `handlers/meetingAnalysisHandler.ts` | Claude Sonnet analysis: prompt, call, parse, persist results + suggestions |
| LC-3.06 | AnalysisJobQueue | `lib/analysisQueue.ts` | Job lifecycle: enqueue, atomic claim (FOR UPDATE SKIP LOCKED), handleFailure |
| LC-3.07 | CommitmentTracker | `lib/commitments.ts` | saveSuggested, confirm (SUGGESTED→OPEN), dismiss (delete), listSuggested |
| LC-3.08 | NotificationService | `lib/notifications.ts` | subscribe, unsubscribe, notifyAnalysisComplete, notifyAnalysisFailed |
| LC-3.09 | withAuth (Unit 1) | `lib/withAuth.ts` | Session validation — inherited, no changes |
| LC-3.10 | Prisma Singleton (Unit 1) | `lib/prisma.ts` | DB client — inherited, no changes |
| LC-3.11 | ApiError Helpers (Unit 1) | `lib/apiError.ts` | Consistent error responses — inherited, no changes |
| LC-3.12 | ClaudeRetryWrapper (Unit 2) | `lib/claude.ts` | `callClaudeWithRetry` — inherited, reused in MeetingAnalysisHandler |

---

## LC-3.01: MeetingIngestionService

**File**: `lib/meetings.ts`
**Patterns**: P-3.01 (Save-First, Analyze-Async), P-3.05 (In-Memory Parsing via FileParsing utility)

**Interface**:
```typescript
export async function ingestPaste(
  managerId: string,
  teammateId: string,
  text: string
): Promise<{ meetingId: string }>

export async function ingestUpload(
  managerId: string,
  teammateId: string,
  fileBuffer: Buffer,
  fileExtension: string
): Promise<{ meetingId: string }>

export async function ingestTranscription(
  managerId: string,
  teammateId: string,
  reviewedText: string
): Promise<{ meetingId: string }>

// shared — used by all three paths
async function enqueueAnalysis(meetingId: string): Promise<void>
```

**Key behaviour — all three paths follow identical pattern**:
```
validate → verify ownership → save Meeting (PENDING_ANALYSIS) → enqueue AnalysisJob → return { meetingId }
```

**Validation rules** (per business rules):
- `ingestPaste`: `text.trim().length >= 50` (BR-3.01)
- `ingestUpload`: extension in `['.txt', '.docx', '.pdf']` (BR-3.02), `file.size <= 10MB` (BR-3.03), extracted text non-empty (BR-3.04)
- `ingestTranscription`: `reviewedText.trim().length > 0` (BR-3.16)

**Dependencies**:
- `LC-3.02` FileParsing (used by ingestUpload)
- `LC-3.06` AnalysisJobQueue (enqueue)
- `LC-3.10` Prisma Singleton

---

## LC-3.02: FileParsing Utility

**File**: `lib/fileParsing.ts`
**Patterns**: P-3.05 (In-Memory File Parsing)

**Interface**:
```typescript
export async function parseTextFromFile(
  buffer: Buffer,
  extension: string    // '.txt' | '.docx' | '.pdf'
): Promise<string>     // returns trimmed plain text

// Extension must be pre-validated before calling this function
// Throws ParseError if extraction yields empty string
// Throws ValidationError for unknown extension (belt-and-suspenders)
```

**Implementation detail**:
```typescript
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

export async function parseTextFromFile(buffer: Buffer, extension: string): Promise<string> {
  let text: string
  switch (extension) {
    case '.txt':
      text = buffer.toString('utf-8').trim()
      break
    case '.docx': {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value.trim()
      break
    }
    case '.pdf': {
      const data = await pdfParse(buffer)
      text = data.text.trim()
      break
    }
    default:
      throw new ValidationError('Only .txt, .docx, and .pdf files are supported.')
  }
  if (!text) throw new ParseError('No readable text found in file. Please check the file and try again.')
  return text
}
```

**Pure function (no side effects)**: no DB access, no network calls. Easily unit-testable with Buffer fixtures.

**Dependencies**:
- `mammoth` npm package
- `pdf-parse` npm package

---

## LC-3.03: StorageService

**File**: `lib/storage.ts`
**Patterns**: P-3.04 (Presigned URL Upload), P-3.08 (Session-Bound Storage Path)

**Interface**:
```typescript
export async function createPresignedUploadUrl(
  bucket: string,
  path: string     // caller constructs path with session-derived managerId
): Promise<string>  // returns signed upload URL

export async function downloadFile(
  bucket: string,
  path: string
): Promise<Buffer>   // throws if file not found

export async function deleteFile(
  bucket: string,
  path: string
): Promise<void>     // silent — does not throw if file already gone
```

**Supabase client**:
```typescript
import { createClient } from '@supabase/supabase-js'

// Module-level singleton (consistent with Prisma and Anthropic pattern)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**Key behaviour — deleteFile is idempotent**:
- Errors from `storage.remove()` are silently swallowed (file may already be gone after a retry)
- Called on transcription success AND on explicit discard — both paths safe to call twice

**Dependencies**:
- `@supabase/supabase-js` npm package

---

## LC-3.04: TranscriptionService

**File**: `lib/transcription.ts`
**Patterns**: P-3.04 (Presigned URL), P-3.08 (Session-Bound Path)

**Interface**:
```typescript
export async function getAudioUploadUrl(
  managerId: string    // from session JWT
): Promise<{ uploadUrl: string; fileId: string }>

export async function transcribeAudio(
  fileId: string,
  managerId: string
): Promise<{ text: string }>
// Throws TranscriptionError on Whisper failure

export async function discardAudio(
  fileId: string,
  managerId: string
): Promise<void>
// Silent — no error if file already gone
```

**OpenAI client**:
```typescript
import OpenAI, { toFile } from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
```

**`transcribeAudio` data flow**:
```
1. path = `${managerId}/${fileId}`
2. audioBuffer = await StorageService.downloadFile('voice-recordings', path)
3. file = await toFile(audioBuffer, 'recording.webm', { type: 'audio/webm' })
4. result = await openai.audio.transcriptions.create({ file, model: 'whisper-1' })
5. await StorageService.deleteFile('voice-recordings', path)  ← always delete, even on error?
   → No: delete only on success; if Whisper fails, client may retry transcription
6. return { text: result.text }
```

**Note on error ordering**: Audio file is deleted AFTER successful Whisper call. If Whisper fails, the file remains — the client can retry `POST /api/transcription/transcribe` again without re-uploading.

**Dependencies**:
- `openai` npm package
- `LC-3.03` StorageService

---

## LC-3.05: MeetingAnalysisHandler

**File**: `handlers/meetingAnalysisHandler.ts`
**Patterns**: P-3.07 (Structured JSON Analysis), P-3.03 (works with cron-based retry via `callClaudeWithRetry`)

**Interface**:
```typescript
export async function analyze(
  meetingId: string,
  client?: Anthropic    // injectable for tests
): Promise<MeetingAnalysisResult>
// Called exclusively by AnalysisJobQueue.processNext()

// Exported pure functions (testable in isolation)
export function buildAnalysisPrompt(
  rawText: string,
  teammateName: string,
  profile: ProfileFields | null
): string

export function parseAnalysisResponse(rawText: string): MeetingAnalysisResult
// Throws AnalysisParseError if JSON cannot be extracted
```

**`analyze` data flow**:
```
1. Load meeting + teammate (prisma.meeting.findUnique + include: { teammate: true })
2. buildAnalysisPrompt(meeting.rawText, teammate.name, teammate.profile)
3. callClaudeWithRetry(
     () => anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2048, ... })
   )
4. parseAnalysisResponse(responseText)
   → filter tags by VALID_TAGS
5. prisma.meeting.update({ status: ANALYSIS_COMPLETE, themes, tags, tone, summary })
6. CommitmentTracker.saveSuggested(meetingId, managerId, teammateId, result.commitments)
7. onComplete(meetingId, managerId, teammateId)
```

**`onComplete`**:
```
1. prisma.analysisJob.update({ status: COMPLETE, processedAt: now() })
2. NotificationService.notifyAnalysisComplete(managerId, teammateId, meeting.createdAt)
```

**Internal constants**:
```typescript
const ANALYSIS_MODEL = 'claude-sonnet-4-6'
const VALID_TAGS = ['growth','delivery','relationships','wellbeing',
                    'strategy','feedback','process','recognition'] as const
```

**Dependencies**:
- `@anthropic-ai/sdk` (via `callClaudeWithRetry` from Unit 2)
- `LC-3.07` CommitmentTracker (saveSuggested)
- `LC-3.08` NotificationService (notifyAnalysisComplete)
- `LC-3.10` Prisma Singleton

---

## LC-3.06: AnalysisJobQueue

**File**: `lib/analysisQueue.ts`
**Patterns**: P-3.02 (Atomic Claim), P-3.03 (Cron-Based Retry)

**Interface**:
```typescript
export async function enqueue(meetingId: string): Promise<void>
// Creates AnalysisJob { meetingId, status: PENDING, retryCount: 0 }

export async function processNext(): Promise<void>
// Claims one eligible job atomically, runs analysis, handles failure

export async function handleFailure(
  jobId: string,
  meetingId: string,
  error: Error,
  currentRetryCount: number
): Promise<void>
// Increments retryCount; permanently fails after 2nd retry
```

**`processNext` flow**:
```typescript
async function processNext(): Promise<void> {
  const job = await claimNextJob()   // FOR UPDATE SKIP LOCKED
  if (!job) return                    // nothing to process

  try {
    await MeetingAnalysisHandler.analyze(job.meetingId)
    // analyze() calls onComplete() internally → marks job COMPLETE
  } catch (err) {
    await handleFailure(job.id, job.meetingId, err as Error, job.retryCount)
  }
}
```

**`claimNextJob` uses raw SQL** (Prisma does not support FOR UPDATE SKIP LOCKED):
```typescript
const rows = await prisma.$queryRaw<AnalysisJobRow[]>`
  UPDATE analysis_jobs
  SET status = 'PROCESSING', "updatedAt" = NOW()
  WHERE id = (
    SELECT id FROM analysis_jobs
    WHERE status = 'PENDING'
       OR (status = 'FAILED' AND "retryCount" < 2)
    ORDER BY "createdAt" ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *
`
```

**Dependencies**:
- `LC-3.05` MeetingAnalysisHandler (analyze)
- `LC-3.08` NotificationService (notifyAnalysisFailed — called from handleFailure on permanent failure)
- `LC-3.10` Prisma Singleton (raw SQL via `$queryRaw`)

---

## LC-3.07: CommitmentTracker

**File**: `lib/commitments.ts`
**Patterns**: P-3.01 (called within analyze → saveSuggested after meeting save)

**Interface** (Unit 3 subset — full lifecycle in Unit 5):
```typescript
export async function saveSuggested(
  meetingId: string,
  managerId: string,
  teammateId: string,
  suggestions: CommitmentSuggestion[]   // { text: string, owner: 'MANAGER' | 'TEAMMATE' }
): Promise<Commitment[]>

export async function confirm(
  managerId: string,
  commitmentId: string,
  editedText?: string
): Promise<Commitment | null>
// Transitions SUGGESTED → OPEN; null if not found or wrong owner/status

export async function dismiss(
  managerId: string,
  commitmentId: string
): Promise<boolean>
// Deletes record; false if not found or wrong owner/status

export async function listSuggested(
  managerId: string,
  teammateId: string
): Promise<Commitment[]>
// Returns all SUGGESTED commitments for the manager+teammate
```

**`confirm` validation**:
```typescript
// Verify ownership AND status === SUGGESTED before updating
const existing = await prisma.commitment.findFirst({
  where: { id: commitmentId, managerId, status: 'SUGGESTED' }
})
if (!existing) return null  // returns 404 in route handler
```

**Dependencies**:
- `LC-3.10` Prisma Singleton

---

## LC-3.08: NotificationService

**File**: `lib/notifications.ts`
**Patterns**: P-3.06 (Notification Failure Isolation)

**Interface**:
```typescript
export async function subscribe(
  managerId: string,
  pushSubscriptionObject: object
): Promise<void>
// Upsert — replaces previous subscription (BR-3.17)

export async function unsubscribe(managerId: string): Promise<void>
// deleteMany({ where: { managerId } })

export async function notifyAnalysisComplete(
  managerId: string,
  teammateId: string,
  meetingDate: Date
): Promise<void>
// Best-effort: push + email; both failures swallowed

export async function notifyAnalysisFailed(
  managerId: string,
  teammateId: string
): Promise<void>
// Best-effort: email only; failure swallowed
```

**VAPID initialisation** (module level):
```typescript
import webPush from 'web-push'

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)
```

**Dependencies**:
- `web-push` npm package
- `resend` (email service, Unit 1)
- `LC-3.10` Prisma Singleton

---

## Component Dependency Map

```
pages/api/meetings/[teammateId]/paste.ts
  └── LC-3.01 MeetingIngestionService (ingestPaste)
  └── LC-3.09 withAuth
  └── LC-3.11 ApiError

pages/api/meetings/[teammateId]/upload.ts
  └── LC-3.01 MeetingIngestionService (ingestUpload)
  └── LC-3.02 FileParsing (via MeetingIngestionService)
  └── LC-3.09 withAuth
  └── LC-3.11 ApiError
  └── formidable (multipart parsing; bodyParser: false)

pages/api/meetings/[teammateId]/save-transcription.ts
  └── LC-3.01 MeetingIngestionService (ingestTranscription)
  └── LC-3.09 withAuth
  └── LC-3.11 ApiError

pages/api/transcription/start.ts
  └── LC-3.04 TranscriptionService (getAudioUploadUrl)
  └── LC-3.03 StorageService (via TranscriptionService)
  └── LC-3.09 withAuth
  └── LC-3.11 ApiError

pages/api/transcription/transcribe.ts
  └── LC-3.04 TranscriptionService (transcribeAudio)
  └── LC-3.03 StorageService (via TranscriptionService)
  └── LC-3.09 withAuth
  └── LC-3.11 ApiError
  └── openai (Whisper; via TranscriptionService)

pages/api/transcription/[fileId].ts (DELETE)
  └── LC-3.04 TranscriptionService (discardAudio)
  └── LC-3.03 StorageService (via TranscriptionService)
  └── LC-3.09 withAuth

pages/api/commitments/[teammateId].ts (GET)
  └── LC-3.07 CommitmentTracker (listSuggested)
  └── LC-3.09 withAuth
  └── LC-3.11 ApiError

pages/api/commitments/[id].ts (PATCH)
  └── LC-3.07 CommitmentTracker (confirm / dismiss)
  └── LC-3.09 withAuth
  └── LC-3.11 ApiError

pages/api/notifications/subscribe.ts (POST / DELETE)
  └── LC-3.08 NotificationService (subscribe / unsubscribe)
  └── LC-3.09 withAuth

pages/api/jobs/process-analysis.ts (GET — cron)
  └── LC-3.06 AnalysisJobQueue (processNext)
  └── LC-3.05 MeetingAnalysisHandler (via AnalysisJobQueue)
  └── LC-3.07 CommitmentTracker (via MeetingAnalysisHandler)
  └── LC-3.08 NotificationService (via MeetingAnalysisHandler + handleFailure)

handlers/meetingAnalysisHandler.ts (LC-3.05)
  └── LC-3.12 ClaudeRetryWrapper (callClaudeWithRetry — Unit 2)
  └── LC-3.07 CommitmentTracker (saveSuggested)
  └── LC-3.08 NotificationService (notifyAnalysisComplete)
  └── @anthropic-ai/sdk

lib/transcription.ts (LC-3.04)
  └── LC-3.03 StorageService
  └── openai (Whisper)

lib/analysisQueue.ts (LC-3.06)
  └── LC-3.05 MeetingAnalysisHandler
  └── LC-3.08 NotificationService (notifyAnalysisFailed)
  └── LC-3.10 Prisma ($queryRaw for atomic claim)

lib/storage.ts (LC-3.03)
  └── @supabase/supabase-js
```

---

## Data Flow Diagrams

### Voice Recording to Analysis Complete

```
Client                    Server                  Supabase       OpenAI    Claude
  |                          |                    Storage        Whisper   Sonnet
  |                          |                       |              |         |
  |--GET /transcription/start-->                     |              |         |
  |                    [auth, cuid()]                |              |         |
  |                    createSignedUploadUrl()------>|              |         |
  |<--{ uploadUrl, fileId }--|                       |              |         |
  |                          |                       |              |         |
  |--PUT audioBlob --------------------------------->|              |         |
  |<--200 OK ----------------------------------------|              |         |
  |                          |                       |              |         |
  |--POST /transcription/transcribe { fileId }-->    |              |         |
  |                    [auth]                        |              |         |
  |                    downloadFile() ------------->|              |         |
  |                    <-- audioBuffer -------------|              |         |
  |                    transcriptions.create() ----------------------->|      |
  |                    <-- { text } -------------------------------|              |
  |                    deleteFile() --------------------->|        |         |
  |<--{ text } --------------|                       |              |         |
  |                          |                       |              |         |
  |--POST /save-transcription { text }-->            |              |         |
  |                    [auth, validate]              |              |         |
  |                    meeting.create(PENDING)       |              |         |
  |                    analysisJob.create(PENDING)   |              |         |
  |<--{ meetingId }----------|                       |              |         |
  |                          |                       |              |         |
  |--navigate: /meeting/[id] |                       |              |         |
  | [polling every 5s]       |                       |              |         |
  |                          |                       |              |         |
  |   ┄┄┄┄┄ Vercel cron (every 30s) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄|         |
  |                          |                       |              |         |
  |             claimNextJob() (FOR UPDATE SKIP LOCKED)             |         |
  |                          |                       |              |         |
  |                          messages.create() ----------------------------------------->|
  |                          <-- analysis JSON ------------------------------------------|
  |                          |                       |              |         |
  |                    meeting.update(ANALYSIS_COMPLETE)            |         |
  |                    commitment.createMany(SUGGESTED)             |         |
  |                    analysisJob.update(COMPLETE)                 |         |
  |                    [P-3.06: notify, swallow errors]             |         |
  |                          |                       |              |         |
  |--GET /meeting/[id] (poll)|                       |              |         |
  |<--{ status: ANALYSIS_COMPLETE, themes, ... }-----|              |         |
```

### Commitment Confirm/Dismiss

```
Client                              Server
  |                                    |
  |--PATCH /api/commitments/[id] -->   |
  |  { action: 'confirm', text? }      |
  |                             [auth: managerId from JWT]
  |                             [find commitment: managerId + status=SUGGESTED]
  |                               if not found → 404
  |                             if action='confirm':
  |                               commitment.update(status=OPEN, text=editedText??existing)
  |                             if action='dismiss':
  |                               commitment.delete()
  |<-- 200 { commitment } or 200 {} ---|
```

---
