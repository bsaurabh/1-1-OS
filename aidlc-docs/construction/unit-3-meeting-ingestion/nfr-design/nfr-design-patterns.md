# NFR Design Patterns — Unit 3: Meeting Ingestion

**Date**: 2026-03-02
**Unit**: Unit 3: Meeting Ingestion

---

## Pattern Overview

| # | Pattern | NFR Addressed |
|---|---------|--------------|
| P-3.01 | Save-First, Analyze-Async | Reliability — notes never lost if Claude fails |
| P-3.02 | Atomic Job Claim (FOR UPDATE SKIP LOCKED) | Reliability — prevents concurrent double-processing |
| P-3.03 | Cron-Based Retry | Reliability — Claude analysis failure recovery across ticks |
| P-3.04 | Presigned URL Audio Upload | Scalability / Performance — audio bypasses Next.js function body |
| P-3.05 | In-Memory File Parsing | Scalability — documents never stored in cloud |
| P-3.06 | Notification Failure Isolation | Reliability — push/email failures never fail analysis job |
| P-3.07 | Structured JSON Analysis with Tag Filtering | Maintainability — single Claude call, enforced taxonomy |
| P-3.08 | Session-Bound Storage Path | Security — audio path derived from JWT, never user-supplied |
| P-3.09 | Client-Side VoiceRecorder State Machine | Usability — 7-state machine with clean error recovery |

---

## P-3.01: Save-First, Analyze-Async Pattern

**Problem**: AI analysis can fail (Claude outage, parse error, cron timeout). If meeting notes are saved only after successful analysis, a Claude failure loses the manager's notes entirely.

**Design**:
```
POST /api/meetings/[id]/paste  (or /upload, /save-transcription)
         |
         v
  [validate input]
         |
         v
  prisma.meeting.create(         ← STEP 1: save first (status: PENDING_ANALYSIS)
    { rawText, status: PENDING_ANALYSIS, ... }
  )
         |
         v
  prisma.analysisJob.create(     ← STEP 2: enqueue async job
    { meetingId, status: PENDING, retryCount: 0 }
  )
         |
         v
  return { meetingId }           ← Client navigates to /meeting/[meetingId]
         |                          (shows AnalysisPendingBanner)
         |
  [Vercel cron — separate invocation, every 30s]
         |
         v
  MeetingAnalysisHandler.analyze(meetingId)
         |
    success          failure
         |                |
         v                v
  Meeting.status =  retryCount++ (up to 2)
  ANALYSIS_COMPLETE  or ANALYSIS_FAILED (permanent)
```

**Key invariant**: `Meeting.rawText` is persisted **before** the `AnalysisJob` is enqueued. Notes survive any downstream failure.

**Implementation**:
```typescript
// lib/meetings.ts — ingestPaste, ingestUpload, ingestTranscription all follow this pattern
async function ingestPaste(managerId: string, teammateId: string, text: string) {
  // 1. Validate (throws on error)
  if (text.trim().length < 50) throw new ValidationError('Please add more detail...')

  // 2. Verify ownership
  const teammate = await getTeammate(managerId, teammateId)
  if (!teammate) throw new NotFoundError()

  // 3. Save meeting (PENDING_ANALYSIS) — this MUST succeed before job enqueue
  const meeting = await prisma.meeting.create({
    data: { managerId, teammateId, rawText: text.trim(), source: 'PASTE', status: 'PENDING_ANALYSIS' }
  })

  // 4. Enqueue analysis job (separate, can fail without losing notes)
  await prisma.analysisJob.create({
    data: { meetingId: meeting.id, status: 'PENDING', retryCount: 0 }
  })

  return { meetingId: meeting.id }
}
```

**Trade-offs**:
- Manager sees their notes immediately (analysis results are async — expected UX)
- If enqueue fails after save, notes are preserved but analysis never starts (acceptable — manager can re-trigger if needed)
- Analysis result page handles `PENDING_ANALYSIS` state gracefully with polling

---

## P-3.02: Atomic Job Claim Pattern (FOR UPDATE SKIP LOCKED)

**Problem**: Vercel cron may invoke the handler concurrently (e.g., if a previous tick is slow and the next tick fires before it completes). Without atomic claiming, two cron invocations could process the same job simultaneously, producing duplicate analysis results and double-sending notifications.

**Design**:
```
Cron tick A (concurrent)              Cron tick B (concurrent)
        |                                      |
        v                                      v
BEGIN TRANSACTION                      BEGIN TRANSACTION
        |                                      |
SELECT id FROM analysis_jobs           SELECT id FROM analysis_jobs
WHERE status='PENDING'                 WHERE status='PENDING'
ORDER BY createdAt ASC                 ORDER BY createdAt ASC
LIMIT 1                                LIMIT 1
FOR UPDATE SKIP LOCKED                 FOR UPDATE SKIP LOCKED
        |                                      |
   Locks job-1                         job-1 is locked → skips it
        |                                      |
UPDATE analysis_jobs                   Returns 0 rows → exits (nothing to do)
SET status='PROCESSING'
WHERE id=job-1
RETURNING *
        |
   Processes job-1
```

**Implementation** (raw Prisma `$queryRaw`):
```typescript
// lib/analysisQueue.ts
async function claimNextJob(): Promise<AnalysisJob | null> {
  const rows = await prisma.$queryRaw<AnalysisJob[]>`
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
  return rows[0] ?? null
}
```

**Eligibility criteria** for claim:
1. `status = 'PENDING'` (new job, never attempted)
2. `status = 'FAILED'` AND `retryCount < 2` (failed but still within retry budget)

**Trade-offs**:
- Requires raw SQL (Prisma ORM does not support `FOR UPDATE SKIP LOCKED`)
- Jobs stuck in `PROCESSING` (e.g., cron function crashed mid-analysis) are never re-claimed — acceptable at PoC scale; add dead-letter handling for production

---

## P-3.03: Cron-Based Retry Pattern

**Problem**: Claude Sonnet analysis can fail due to transient outages. In-request retry (within the same function invocation) blocks the Vercel function and can exceed `maxDuration`. Cron-based retry defers recovery to the next tick.

**Design**:
```
Cron tick N                     Cron tick N+1               Cron tick N+2
    |                               |                             |
Claim job                       Claim FAILED job             Claim FAILED job
(retryCount=0)                  (retryCount=1)               (retryCount=2)
    |                               |                             |
Claude call FAILS               Claude call FAILS            Claude call FAILS
    |                               |                             |
retryCount → 1                  retryCount → 2               retryCount → 3 (>= 2)
status → FAILED                 status → FAILED              status → FAILED (permanent)
Meeting: unchanged              Meeting: unchanged           Meeting → ANALYSIS_FAILED
                                                             Notify manager (email)
```

**Implementation**:
```typescript
// lib/analysisQueue.ts
async function handleFailure(
  jobId: string,
  meetingId: string,
  error: Error,
  currentRetryCount: number
): Promise<void> {
  const newRetryCount = currentRetryCount + 1

  await prisma.analysisJob.update({
    where: { id: jobId },
    data: { status: 'FAILED', retryCount: newRetryCount, error: error.message }
  })

  if (newRetryCount >= 2) {
    // Permanently failed — update meeting and notify manager
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'ANALYSIS_FAILED' }
    })
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { teammate: true }
    })
    if (meeting) {
      await notifyAnalysisFailed(meeting.managerId, meeting.teammateId)
    }
  }
  // If newRetryCount < 2: job will be re-claimed on next cron tick
}
```

**Interaction with `callClaudeWithRetry`**: The in-request `callClaudeWithRetry` (1 retry, 1s delay, from Unit 2) still applies within a single cron invocation. The cron-based retry is the **outer** layer for harder failures (e.g., Claude 500 that persists across the in-request retry).

```
Cron invocation
    |
callClaudeWithRetry (inner — up to 1 retry in 1s)
    |-- success --> mark COMPLETE
    |-- both attempts fail --> handleFailure (outer — increment retryCount)
```

**Trade-offs**:
- Up to ~60s delay before retry (30s cron interval × 2 ticks)
- Acceptable for async analysis where the manager is notified on completion
- 3 total attempts covers most transient Claude outages without looping indefinitely

---

## P-3.04: Presigned URL Audio Upload Pattern

**Problem**: Browser `MediaRecorder` produces audio blobs up to 25MB. Streaming a 25MB binary through a Next.js serverless function body would consume excessive memory, risk `maxDuration` timeouts, and saturate function bandwidth.

**Design**:
```
Client                        Server                    Supabase Storage
  |                              |                              |
  |-- GET /api/transcription/start -->                          |
  |                              |                              |
  |                   Generate fileId (cuid)                    |
  |                   createSignedUploadUrl(                    |
  |                     'voice-recordings',                     |
  |                     `${managerId}/${fileId}`  ←── from session JWT
  |                   )                                         |
  |<-- { uploadUrl, fileId } ----|                              |
  |                              |                              |
  |-- PUT audioBlob → uploadUrl -------------------------------->|
  |   (direct browser→storage, no Next.js involvement)         |
  |<-- 200 OK (from Supabase) ----------------------------------|
  |                              |                              |
  |-- POST /api/transcription/transcribe { fileId } -->         |
  |                              |                              |
  |                   Download file from                        |
  |                   `${managerId}/${fileId}` ----------------->|
  |                   <-- audioBuffer -----------------------------|
  |                   Send to Whisper API                        |
  |                   <-- transcription.text                     |
  |                   Delete file from storage ----------------->|
  |<-- { text: transcription } --|                              |
```

**Key property**: The audio binary never passes through the Next.js API layer. Only the `fileId` (a short CUID string) is sent to the transcription route.

**Implementation**:
```typescript
// GET /api/transcription/start
async function getAudioUploadUrl(managerId: string) {
  const fileId = cuid()
  const path = `${managerId}/${fileId}`
  const uploadUrl = await storageService.createPresignedUploadUrl('voice-recordings', path)
  return { uploadUrl, fileId }
}

// POST /api/transcription/transcribe
async function transcribe(fileId: string, managerId: string) {
  const path = `${managerId}/${fileId}`
  const audioBuffer = await storageService.downloadFile('voice-recordings', path)
  const text = await transcriptionService.transcribeAudio(audioBuffer, 'audio/webm')
  await storageService.deleteFile('voice-recordings', path)   // clean up immediately
  return { text }
}
```

**Trade-offs**:
- Two additional round-trips (start → upload → transcribe) compared to direct upload
- Eliminates memory pressure on serverless functions for large audio files
- Supabase Storage presigned URLs expire in 60s (sufficient for immediate upload)

---

## P-3.05: In-Memory File Parsing Pattern

**Problem**: `.docx` and `.pdf` meeting transcript files are uploaded for text extraction. Storing them in cloud storage adds cost, lifecycle complexity, and latency. Only the extracted text is needed.

**Design**:
```
POST /api/meetings/[id]/upload (multipart/form-data)
        |
        v
formidable (bodyParser: false)
  maxFileSize: 10MB
  maxFiles: 1
  in-memory storage
        |
        v
  file.buffer (held in function memory)
        |
        v
parseTextFromFile(buffer, extension)
  ├── .txt  → buffer.toString('utf-8').trim()
  ├── .docx → mammoth.extractRawText({ buffer }) → result.value.trim()
  └── .pdf  → pdfParse(buffer) → data.text.trim()
        |
        v
  rawText (string) ──→ prisma.meeting.create(rawText)
        |
  [buffer goes out of scope → GC]
        |
        v
  No document stored anywhere (only rawText in DB)
```

**Key property**: The original document binary is never written to disk or cloud storage. Only the extracted plain text persists.

**Implementation**:
```typescript
// lib/fileParsing.ts
export async function parseTextFromFile(buffer: Buffer, extension: string): Promise<string> {
  switch (extension) {
    case '.txt':
      return buffer.toString('utf-8').trim()
    case '.docx': {
      const result = await mammoth.extractRawText({ buffer })
      return result.value.trim()
    }
    case '.pdf': {
      const data = await pdfParse(buffer)
      return data.text.trim()
    }
    default:
      throw new ValidationError('Only .txt, .docx, and .pdf files are supported.')
  }
}
```

**Trade-offs**:
- Serverless function memory limit (1024MB on Vercel): a 10MB PDF in memory with parsing overhead is well within limits
- Parsing latency: mammoth ~200ms, pdf-parse ~500ms for large files — contributes to the upload route p95 < 3s target
- Cannot re-parse if the original file is needed later (acceptable — raw text is sufficient for analysis)

---

## P-3.06: Notification Failure Isolation Pattern

**Problem**: Browser push subscriptions expire (410 Gone), and Resend email delivery can fail transiently. If these failures propagate to the cron job, the `AnalysisJob` gets incorrectly marked FAILED even though the actual analysis succeeded.

**Design**:
```
analyze(meetingId)
    |
    v
[Claude Sonnet analysis succeeds]
    |
    v
[Meeting.status = ANALYSIS_COMPLETE] ← persisted BEFORE notifications
    |
    v
[AnalysisJob.status = COMPLETE]
    |
    v
notifyAnalysisComplete(managerId, teammateId, meetingDate)
    ├── try { webPush.sendNotification(...) }
    │     catch (err) { console.error('[push] failed:', err) }  ← swallowed
    │
    └── try { resend.emails.send(...) }
          catch (err) { console.error('[email] failed:', err) } ← swallowed
    |
    v
cron handler returns 200 OK ← analysis success is independent of notification success
```

**Key property**: `Meeting.status = ANALYSIS_COMPLETE` and `AnalysisJob.status = COMPLETE` are persisted synchronously **before** any notification attempt. Notification failures are logged but never bubble up.

**Implementation**:
```typescript
// lib/notifications.ts
export async function notifyAnalysisComplete(
  managerId: string,
  teammateId: string,
  meetingDate: Date
): Promise<void> {
  const [pushSub, teammate, manager] = await Promise.all([
    prisma.pushSubscription.findUnique({ where: { managerId } }),
    prisma.teammate.findUnique({ where: { id: teammateId } }),
    prisma.manager.findUnique({ where: { id: managerId } }),
  ])

  // Push notification — best-effort
  if (pushSub) {
    try {
      await webPush.sendNotification(
        pushSub.subscription as webPush.PushSubscription,
        JSON.stringify({
          title: 'Analysis complete',
          body: `Your 1:1 with ${teammate?.name} has been analyzed.`,
          url: `/teammates/${teammateId}`,
        })
      )
    } catch (err) {
      console.error('[push] notification failed:', err instanceof Error ? err.message : err)
      // 410 Gone = expired subscription; log but do NOT delete here (TD-13)
    }
  }

  // Email — best-effort
  try {
    await emailService.sendAnalysisCompleteEmail(
      manager?.email ?? '',
      teammate?.name ?? 'your teammate',
      teammateId,
      meetingDate
    )
  } catch (err) {
    console.error('[email] analysis complete notification failed:', err instanceof Error ? err.message : err)
  }
}
```

**Trade-offs**:
- Notification failures are invisible to the manager unless they check logs
- The polling mechanism (5s interval) catches analysis completion regardless of notifications
- Acceptable at PoC scale; production would add a notification delivery audit table

---

## P-3.07: Structured JSON Analysis with Tag Taxonomy Filtering Pattern

**Problem**: Claude's analysis output must contain structured fields (themes, tags, tone, summary, commitments). Free-form tag generation produces inconsistent categories that break filtering in Unit 5. A single prompt call must return all fields reliably.

**Design**:
```
buildAnalysisPrompt(rawText, teammateName, profile)
    |
    v
System: "Return ONLY valid JSON matching this schema:
  {
    themes: [{ title, description }],  // 2–5 themes
    tags: string[],                    // 1–3 from: growth|delivery|relationships|
                                       //           wellbeing|strategy|feedback|
                                       //           process|recognition
    tone: string,                      // one word or short phrase
    summary: string,                   // one sentence
    commitments: [{ text, owner }]     // owner: MANAGER | TEAMMATE, may be []
  }"
User: [rawText]
    |
    v
Claude Sonnet response (raw text)
    |
    v
parseAnalysisResponse(rawText)
    ├── JSON.parse(rawText)  → success → MeetingAnalysisResult
    ├── regex: /\{[\s\S]*\}/ + JSON.parse → success
    └── both fail → throw AnalysisParseError (triggers cron retry)
    |
    v
[tag taxonomy enforcement]
const VALID_TAGS = ['growth','delivery','relationships','wellbeing',
                   'strategy','feedback','process','recognition']
result.tags = result.tags.filter(t => VALID_TAGS.includes(t))
// tags outside the set are silently dropped
```

**Attribution logic in prompt** (commitment owner):
```
"I will..." or "I'll..." → owner: "MANAGER"
"[teammateName] will..." → owner: "TEAMMATE"
"You will..." (manager speaking to teammate) → owner: "TEAMMATE"
Ambiguous → owner: "MANAGER" (default)
```

**Implementation**:
```typescript
// handlers/meetingAnalysisHandler.ts
const VALID_TAGS = ['growth','delivery','relationships','wellbeing',
                    'strategy','feedback','process','recognition'] as const

function parseAnalysisResponse(rawText: string): MeetingAnalysisResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/)
    if (!match) throw new AnalysisParseError('Could not extract JSON from Claude response')
    parsed = JSON.parse(match[0])
  }

  const result = parsed as MeetingAnalysisResult
  // Enforce tag taxonomy — silently drop unknown tags
  result.tags = (result.tags ?? []).filter(t => (VALID_TAGS as readonly string[]).includes(t))
  return result
}
```

**Trade-offs**:
- Silent tag filtering may reduce tags to `[]` if Claude returns invalid tags (acceptable — empty tags handled in UI)
- Single call approach means all 5 field types must succeed together (failure triggers full retry)
- `max_tokens: 2048` is generous to avoid truncated JSON (consistent with Unit 2 synthesis approach)

---

## P-3.08: Session-Bound Storage Path Pattern

**Problem**: Audio files are stored in Supabase Storage under a path that includes the manager's ID. If the path uses a user-supplied `managerId`, an attacker could craft requests to access or overwrite another manager's audio files.

**Design**:
```
Client requests presigned URL:
  GET /api/transcription/start
       |
  [withAuth] → extracts managerId from JWT cookie
       |                              ↑
  managerId NEVER from              Verified session token
  query params or body               (never user-controllable)
       |
  fileId = cuid()                 ← server-generated, not user-supplied
       |
  path = `${managerId}/${fileId}` ← both components are server-controlled
       |
  createSignedUploadUrl(bucket, path)
       |
  return { uploadUrl, fileId }
       |
Client downloads fileId and uses it for transcription:
  POST /api/transcription/transcribe { fileId }
       |
  [withAuth] → managerId from JWT
       |
  path = `${managerId}/${fileId}` ← reconstructed server-side from session
       |
  storageService.downloadFile(bucket, path)
```

**Key property**: The storage path is always reconstructed server-side from the session JWT `managerId`. The client only provides the `fileId` (CUID) — it has no control over the `managerId` component of the path.

**Security guarantees**:
- A client cannot access `{otherManagerId}/{fileId}` because `managerId` comes from their own session
- The bucket is private — no direct browser access without a presigned URL
- Service role key is server-side only — client cannot generate its own presigned URLs

**Trade-offs**:
- Presigned URLs expire (60s) — client must upload immediately after receiving the URL
- The `fileId` is a CUID — not guessable, but not a secret (the path isolation is the primary protection)

---

## P-3.09: Client-Side VoiceRecorder State Machine Pattern

**Problem**: Voice recording involves multiple async phases (permission, recording, upload, transcription, review) each with distinct UI states and failure modes. Representing this as ad-hoc boolean flags leads to impossible state combinations.

**Design** (7-state machine):
```
                    ┌─────────────────────────────────────────────────┐
                    │               ERROR (any state)                  │
                    │          [Try Again → IDLE]                     │
                    └────────────────────┬────────────────────────────┘
                                         ↑ on any failure
IDLE ──click──→ REQUESTING ──granted──→ RECORDING ──stop──→ UPLOADING
                         │                                      │
                   denied↓                                 success↓
                       ERROR                             TRANSCRIBING
                                                              │
                                                         success↓
                                                           REVIEW ──save──→ onSuccess(meetingId)
                                                                  └─discard──→ onDiscarded()
```

**State transitions**:
| From | Event | To | Action |
|------|-------|----|--------|
| `IDLE` | Click record button | `REQUESTING` | `navigator.mediaDevices.getUserMedia({ audio: true })` |
| `REQUESTING` | Permission granted | `RECORDING` | Create `MediaRecorder`, start timer |
| `REQUESTING` | Permission denied | `ERROR` | Set error message |
| `RECORDING` | Click stop | `UPLOADING` | Collect audio chunks, GET /api/transcription/start |
| `UPLOADING` | PUT success | `TRANSCRIBING` | POST /api/transcription/transcribe |
| `UPLOADING` | PUT failure | `ERROR` | Set error message |
| `TRANSCRIBING` | Response received | `REVIEW` | Set `transcription = data.text` |
| `TRANSCRIBING` | Request failure | `ERROR` | Set error message |
| `REVIEW` | Save & Analyze | (closes / navigates) | POST /api/meetings/[id]/save-transcription |
| `REVIEW` | Discard | (resets to IDLE) | DELETE /api/transcription/[fileId] |
| `ERROR` | Try Again | `IDLE` | Reset all state |

**Implementation**:
```typescript
// components/meetings/VoiceRecorder.tsx
type RecorderState =
  | 'IDLE' | 'REQUESTING' | 'RECORDING'
  | 'UPLOADING' | 'TRANSCRIBING' | 'REVIEW' | 'ERROR'

const [recorderState, setRecorderState] = useState<RecorderState>('IDLE')
const [fileId, setFileId] = useState<string | null>(null)
const [transcription, setTranscription] = useState('')
const [error, setError] = useState<string | null>(null)
const [elapsedSeconds, setElapsedSeconds] = useState(0)
```

**Trade-offs**:
- 7 states × 2 conditions each = well-defined, exhaustive UI coverage
- State machine prevents impossible states (e.g., showing "Stop Recording" while uploading)
- Discard in REVIEW state calls DELETE regardless of response (idempotent cleanup)

---

## Pattern Interaction Diagram

### Full Meeting Ingestion Flow

```
Manager submits meeting (any of 3 paths)
           |
    ┌──────┼──────────────────────────────┐
    │      │                              │
  Paste  Upload                    Voice Recording
    │      │                        [P-3.09 State Machine]
    │   [P-3.05 In-Memory Parse]         │
    │      │                        [P-3.04 Presigned URL]
    │      │                        GET /transcription/start
    │      │                        PUT audioBlob → Supabase
    │      │                        POST /transcription/transcribe
    │      │                              │ [P-3.08 Session Path]
    └──────┴──────────────────────────────┘
                       │
              POST /meetings/[id]/{method}
                       │
               [P-3.01 Save-First]
               prisma.meeting.create(PENDING_ANALYSIS)
               prisma.analysisJob.create(PENDING)
                       │
               return { meetingId }
                       │
          Client → /meeting/[meetingId] (polling)

  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ async cron (every 30s) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄

GET /api/jobs/process-analysis
                       │
               [P-3.02 Atomic Claim]
               FOR UPDATE SKIP LOCKED
                       │
               MeetingAnalysisHandler.analyze()
                       │
               [P-3.07 Structured JSON]
               callClaudeWithRetry(Sonnet)
               parseAnalysisResponse()
               filter tags by VALID_TAGS
                       │
               persist results (ANALYSIS_COMPLETE)
                       │
               [P-3.06 Notification Isolation]
               try { webPush } catch (swallow)
               try { resend }  catch (swallow)
                       │
               cron returns 200

         [failure path → P-3.03 Cron-Based Retry]
               handleFailure → retryCount++
               if retryCount >= 2 → ANALYSIS_FAILED → notify
```

---
