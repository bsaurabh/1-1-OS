# Deployment Architecture — Unit 3: Meeting Ingestion

**Date**: 2026-03-02
**Unit**: Unit 3: Meeting Ingestion

---

## Component-to-Service Mapping

| Logical Component | Code Location | Deployed As | Service |
|------------------|--------------|-------------|---------|
| MeetingIngestionService | `lib/meetings.ts` | Module within serverless function | Vercel |
| FileParsing Utility | `lib/fileParsing.ts` | Module within serverless function | Vercel |
| StorageService | `lib/storage.ts` | Module within serverless function | Vercel |
| TranscriptionService | `lib/transcription.ts` | Module within serverless function | Vercel |
| MeetingAnalysisHandler | `handlers/meetingAnalysisHandler.ts` | Module within cron function | Vercel |
| AnalysisJobQueue | `lib/analysisQueue.ts` | Module within cron function | Vercel |
| CommitmentTracker | `lib/commitments.ts` | Module within serverless function | Vercel |
| NotificationService | `lib/notifications.ts` | Module within cron function | Vercel |
| Paste ingestion route | `pages/api/meetings/[id]/paste.ts` | Serverless function (10s) | Vercel |
| Upload ingestion route | `pages/api/meetings/[id]/upload.ts` | Serverless function (10s, bodyParser off) | Vercel |
| Save transcription route | `pages/api/meetings/[id]/save-transcription.ts` | Serverless function (10s) | Vercel |
| Transcription start route | `pages/api/transcription/start.ts` | Serverless function (10s) | Vercel |
| Transcription transcribe route | `pages/api/transcription/transcribe.ts` | Serverless function **(60s)** | Vercel |
| Transcription discard route | `pages/api/transcription/[fileId].ts` | Serverless function (10s) | Vercel |
| Meeting status poll route | `pages/api/meetings/[id]/[meetingId].ts` | Serverless function (10s) | Vercel |
| Commitments list route | `pages/api/commitments/[teammateId].ts` | Serverless function (10s) | Vercel |
| Commitments patch route | `pages/api/commitments/[id].ts` | Serverless function (10s) | Vercel |
| Push subscribe route | `pages/api/notifications/subscribe.ts` | Serverless function (10s) | Vercel |
| Analysis cron route | `pages/api/jobs/process-analysis.ts` | Serverless function **(60s)** + Vercel Cron | Vercel |
| Meeting results page | `pages/teammates/[id]/meeting/[meetingId].tsx` | SSR serverless function | Vercel |
| React meeting UI components | `components/meetings/`, `components/commitments/` | Static JS bundle | Vercel CDN |
| meetings table | `prisma/schema.prisma` | PostgreSQL table | Supabase |
| analysis_jobs table | `prisma/schema.prisma` | PostgreSQL table (+ retryCount migration) | Supabase |
| commitments table | `prisma/schema.prisma` | PostgreSQL table | Supabase |
| push_subscriptions table | `prisma/schema.prisma` | PostgreSQL table | Supabase |
| Audio files (transient) | Supabase Storage | Object storage | Supabase Storage |
| whisper-1 | External | Managed AI API | OpenAI |
| claude-sonnet-4-6 (analysis) | External | Managed AI API | Anthropic |

---

## Request Flow Diagrams

### Flow 1: Paste Notes Ingestion

```
Browser
  │  POST /api/meetings/[id]/paste
  │  { text: "Today we discussed..." }
  ▼
Vercel Serverless Function (10s)
  │  withAuth → managerId
  │  Validate text.trim().length >= 50 (BR-3.01)
  │  MeetingIngestionService.ingestPaste(managerId, teammateId, text)
  │    → getTeammate(managerId, teammateId) → ownership check
  │    → prisma.meeting.create({ rawText, source:'PASTE', status:'PENDING_ANALYSIS' })
  │    → prisma.analysisJob.create({ meetingId, status:'PENDING', retryCount:0 })
  │  Return { meetingId }
  ▼
Browser
  │  Navigate to /teammates/[id]/meeting/[meetingId]
  │  [AnalysisPendingBanner displayed, polling starts]
```

---

### Flow 2: File Upload Ingestion (.docx / .pdf / .txt)

```
Browser
  │  POST /api/meetings/[id]/upload
  │  multipart/form-data; file=<file.pdf>
  ▼
Vercel Serverless Function (10s, bodyParser: false)
  │  withAuth → managerId
  │  formidable.parse(req) → { buffer, extension }
  │    maxFiles: 1, maxFileSize: 10MB
  │  Validate extension in ['.txt', '.docx', '.pdf'] (BR-3.02)
  │  FileParsing.parseTextFromFile(buffer, extension)
  │    .txt  → buffer.toString('utf-8')
  │    .docx → mammoth.extractRawText({ buffer })
  │    .pdf  → pdfParse(buffer)
  │  Validate extracted text non-empty (BR-3.04)
  │  MeetingIngestionService → prisma.meeting.create(PENDING_ANALYSIS)
  │  MeetingIngestionService → prisma.analysisJob.create(PENDING)
  │  Return { meetingId }
  ▼
Browser
  │  Navigate to /teammates/[id]/meeting/[meetingId]
```

---

### Flow 3: Voice Recording — Full Lifecycle

```
Browser                    Vercel              Supabase Storage     OpenAI
  │                           │                     │                 │
  │  Click "Record"           │                     │                 │
  │  getUserMedia()           │                     │                 │
  │  MediaRecorder.start()    │                     │                 │
  │  [recording timer runs]   │                     │                 │
  │                           │                     │                 │
  │  Click "Stop"             │                     │                 │
  │  MediaRecorder.stop()     │                     │                 │
  │  → audioBlob collected    │                     │                 │
  │                           │                     │                 │
  │  GET /transcription/start │                     │                 │
  ▼                           │                     │                 │
  Vercel Function (10s)       │                     │                 │
  │  withAuth → managerId     │                     │                 │
  │  fileId = cuid()          │                     │                 │
  │  path = `{mgrId}/{fileId}`│                     │                 │
  │  supabase.storage.        │                     │                 │
  │    createSignedUploadUrl()│─────────────────────►                 │
  │  ◄─────────────────────────────────{ signedUrl }                  │
  │  return { uploadUrl, fileId }                    │                 │
  ▼                           │                     │                 │
Browser                       │                     │                 │
  │  PUT audioBlob → uploadUrl─────────────────────►│                 │
  │                           │                     │ store audio     │
  │  ◄────────────────────────────────── 200 OK ────│                 │
  │                           │                     │                 │
  │  POST /transcription/transcribe { fileId }       │                 │
  ▼                           │                     │                 │
  Vercel Function (60s)       │                     │                 │
  │  withAuth → managerId     │                     │                 │
  │  path = `{mgrId}/{fileId}`│                     │                 │
  │  supabase.storage.download()───────────────────►│                 │
  │  ◄──────────────────────────────── audioBuffer ─│                 │
  │  openai.audio.transcriptions.create()───────────────────────────►│
  │                           │                     │  whisper-1      │
  │  ◄──────────────────────────────────────────────────── { text } ──│
  │  supabase.storage.remove()─────────────────────►│                 │
  │  ◄──────────────────────────────── deleted ─────│                 │
  │  return { text }          │                     │                 │
  ▼                           │                     │                 │
Browser                       │                     │                 │
  │  [TranscriptionReview shown: editable textarea] │                 │
  │  Manager reviews/edits transcription            │                 │
  │                           │                     │                 │
  │  POST /meetings/[id]/save-transcription { text }│                 │
  ▼                           │                     │                 │
  Vercel Function (10s)       │                     │                 │
  │  meeting.create(PENDING_ANALYSIS)               │                 │
  │  analysisJob.create(PENDING)                    │                 │
  │  return { meetingId }     │                     │                 │
  ▼                           │                     │                 │
Browser                       │                     │                 │
  │  Navigate to /meeting/[meetingId]               │                 │
```

---

### Flow 4: Cron Analysis Processing

```
Vercel Cron (every ~1 min)             Supabase DB        Claude API
  │                                         │                  │
  │  GET /api/jobs/process-analysis         │                  │
  │  [CRON_SECRET validation]               │                  │
  ▼                                         │                  │
  Vercel Function (60s max)                 │                  │
  │  AnalysisJobQueue.processNext()          │                  │
  │    $queryRaw: UPDATE analysis_jobs      │                  │
  │    SET status='PROCESSING'              │                  │
  │    WHERE id = (SELECT ... FOR UPDATE    │                  │
  │                SKIP LOCKED)             │                  │
  │    RETURNING * ─────────────────────────►                  │
  │    ◄──────────────────── { job } ───────│                  │
  │                                         │                  │
  │  [no job found → return 200 immediately]│                  │
  │                                         │                  │
  │  MeetingAnalysisHandler.analyze(meetingId)                 │
  │    prisma.meeting.findUnique            │                  │
  │    (include: teammate) ─────────────────►                  │
  │    ◄── { meeting, teammate } ───────────│                  │
  │                                         │                  │
  │    buildAnalysisPrompt(rawText, name)   │                  │
  │    callClaudeWithRetry(               ──────────────────────►
  │      sonnet-4-6, max_tokens:2048)       │                  │
  │    ◄─────────────────────── { analysis JSON } ─────────────│
  │                                         │                  │
  │    parseAnalysisResponse()              │                  │
  │    filter tags by VALID_TAGS            │                  │
  │                                         │                  │
  │    prisma.meeting.update(               │                  │
  │      ANALYSIS_COMPLETE, themes, ...) ───►                  │
  │    CommitmentTracker.saveSuggested() ───►                  │
  │    prisma.analysisJob.update(COMPLETE) ─►                  │
  │                                         │                  │
  │  NotificationService.notifyAnalysisComplete()              │
  │    [try push → catch swallow]           │                  │
  │    [try email → catch swallow]          │                  │
  │                                         │                  │
  │  return 200 OK                          │                  │
```

---

### Flow 5: Analysis Failure and Cron Retry

```
Cron tick N                   Cron tick N+1              Cron tick N+2 (permanent fail)
     │                              │                             │
Claim job                      Claim FAILED                  Claim FAILED
(retryCount=0)                 (retryCount=1)                (retryCount=2)
     │                              │                             │
callClaudeWithRetry()          callClaudeWithRetry()         callClaudeWithRetry()
→ fails (after inner retry)    → fails                       → fails
     │                              │                             │
handleFailure(retryCount=0)    handleFailure(retryCount=1)   handleFailure(retryCount=2)
→ job.retryCount = 1           → job.retryCount = 2          → job.retryCount = 3
→ job.status = FAILED          → job.status = FAILED         → job.status = FAILED (permanent)
→ Meeting: unchanged           → Meeting: unchanged          → Meeting.status = ANALYSIS_FAILED
                                                             → notifyAnalysisFailed(email)

Cron tick N+3:
Claim query checks:
  status='PENDING' OR (status='FAILED' AND retryCount < 2)
Job has retryCount=3 → NOT eligible → no-op
```

---

### Flow 6: Commit Confirm / Dismiss

```
Browser
  │  GET /teammates/[id]/meeting/[meetingId]  (SSR poll)
  ▼
Vercel SSR Function (10s)
  │  withAuth → managerId
  │  prisma.meeting.findUnique (status: ANALYSIS_COMPLETE, themes, tags, ...)
  │  CommitmentTracker.listSuggested(managerId, teammateId)
  │  Render MeetingAnalysisResults + SuggestedCommitments
  ▼
Browser
  │  [Commitment list rendered]
  │
  │  Click "Confirm" on commitment
  │  PATCH /api/commitments/[commitmentId]
  │  { action: 'confirm', text?: editedText }
  ▼
Vercel Serverless Function (10s)
  │  withAuth → managerId
  │  CommitmentTracker.confirm(managerId, commitmentId, editedText?)
  │    → findFirst({ id, managerId, status:'SUGGESTED' })
  │    → if not found: return null → 404
  │    → prisma.commitment.update({ status:'OPEN', text: editedText ?? existing.text })
  │  Return 200 { commitment }
  ▼
Browser
  │  Remove confirmed item from SuggestedCommitments list
  │  [onChange updates parent state]
```

---

## Environment Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  LOCAL DEVELOPMENT                                           │
│                                                              │
│  npm run dev (Next.js dev server :3000)                      │
│                                                              │
│  .env.local:                                                 │
│    DATABASE_URL=postgresql://...                             │
│    DIRECT_URL=postgresql://...                               │
│    SECRET_KEY=local-dev-secret...                            │
│    RESEND_API_KEY=re_placeholder                             │
│    CRON_SECRET=local-cron-secret                             │
│    NEXT_PUBLIC_APP_URL=http://localhost:3000                  │
│    ANTHROPIC_API_KEY=sk-ant-...          [Unit 2]            │
│    OPENAI_API_KEY=sk-...                 [NEW Unit 3]        │
│    NEXT_PUBLIC_VAPID_PUBLIC_KEY=BExa...  [NEW Unit 3]        │
│    VAPID_PRIVATE_KEY=Exa...              [NEW Unit 3]        │
│    VAPID_SUBJECT=mailto:admin@example.com [NEW Unit 3]       │
│    SUPABASE_URL=https://xyz.supabase.co  [NEW Unit 3]        │
│    SUPABASE_SERVICE_ROLE_KEY=eyJ...      [NEW Unit 3]        │
│                                                              │
│  External calls:                                             │
│    ├── Supabase PostgreSQL (dev project)                     │
│    ├── Supabase Storage (dev project, voice-recordings)      │
│    ├── Anthropic Claude API (real calls)                     │
│    └── OpenAI Whisper API (real calls)                       │
│                                                              │
│  Cron simulation (manual):                                   │
│    curl http://localhost:3000/api/jobs/process-analysis      │
│         -H "Authorization: Bearer local-cron-secret"        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  PRODUCTION (Vercel)                                         │
│                                                              │
│  Build: prisma generate && next build                        │
│  Deploy: git push → Vercel CI/CD                             │
│                                                              │
│  Vercel Environment Variables (all 13 after Unit 3):         │
│    DATABASE_URL             (Unit 1)                         │
│    DIRECT_URL               (Unit 1)                         │
│    SECRET_KEY               (Unit 1)                         │
│    RESEND_API_KEY            (Unit 1)                        │
│    CRON_SECRET               (Unit 1)                        │
│    NEXT_PUBLIC_APP_URL       (Unit 1)                        │
│    ANTHROPIC_API_KEY         (Unit 2)                        │
│    OPENAI_API_KEY            [NEW Unit 3]                    │
│    NEXT_PUBLIC_VAPID_PUBLIC_KEY [NEW Unit 3]                 │
│    VAPID_PRIVATE_KEY         [NEW Unit 3]                    │
│    VAPID_SUBJECT             [NEW Unit 3]                    │
│    SUPABASE_URL              [NEW Unit 3]                    │
│    SUPABASE_SERVICE_ROLE_KEY [NEW Unit 3]                    │
│                                                              │
│  Serverless functions:                                       │
│    /api/auth/*                   → 10s (Unit 1)              │
│    /api/teammates/*              → 10s (Unit 2)              │
│    /api/interviews/*             → 30s (Unit 2)              │
│    /api/meetings/*/*             → 10s [NEW Unit 3]          │
│    /api/transcription/start      → 10s [NEW Unit 3]          │
│    /api/transcription/transcribe → 60s [NEW Unit 3]          │
│    /api/transcription/[fileId]   → 10s [NEW Unit 3]          │
│    /api/commitments/*            → 10s [NEW Unit 3]          │
│    /api/notifications/subscribe  → 10s [NEW Unit 3]          │
│    /api/jobs/process-analysis    → 60s [NEW Unit 3] (cron)   │
│                                                              │
│  Vercel Cron:                                                │
│    */1 * * * * → /api/jobs/process-analysis (every 1 min)   │
│                                                              │
│  External calls:                                             │
│    ├── Supabase PostgreSQL (prod project)                    │
│    ├── Supabase Storage (prod project, voice-recordings)     │
│    ├── Anthropic Claude API (Sonnet)                         │
│    ├── OpenAI Whisper API                                    │
│    └── Browser Push Services (via web-push VAPID)           │
└──────────────────────────────────────────────────────────────┘
```

---

## Infrastructure Changes vs Unit 2

| Dimension | Unit 2 | Unit 3 Change |
|-----------|--------|---------------|
| Vercel functions | 7 routes (CRUD + interview) | + 11 new routes (ingestion, transcription, commitments, notifications, cron) |
| Function timeout | 30s max (interview) | + 60s on 2 routes (transcribe, cron) |
| Body parser disabled | None | + 1 route (upload — formidable) |
| Vercel cron | Scaffold (returns 200) | **Fully wired** — claims job, runs Claude analysis, notifies |
| External services | Anthropic Claude API | + OpenAI Whisper API, + Supabase Storage, + web-push |
| Storage services | None | + Supabase Storage (voice-recordings bucket) |
| Environment variables | 7 vars | + 6 vars (13 total) |
| DB migrations | None (Unit 2) | + 1 migration (retryCount on analysis_jobs) |
| npm packages (runtime) | 1 new (Unit 2: @anthropic-ai/sdk) | + 6 new: openai, web-push, mammoth, pdf-parse, formidable, @supabase/supabase-js |
| npm packages (dev) | None (Unit 2) | + 2 new: @types/web-push, @types/pdf-parse |

---

## Technical Debt Inherited + New

| ID | Item | Infrastructure Impact |
|----|------|-----------------------|
| TD-01 | No rate limiting | All 11 new routes callable at unlimited rate; OpenAI/Anthropic costs uncapped |
| TD-10 | No rate limiting on file upload | Large files (10MB) could be uploaded rapidly; formidable enforces size but not frequency |
| TD-11 | Orphaned audio on server crash | Files remain in `voice-recordings` bucket; no scheduled cleanup job |
| TD-12 | Push requires HTTPS | Vercel production is HTTPS; local dev browser push subscription requires HTTPS tunnel (e.g. ngrok) or skip push in dev |
| TD-13 | Expired push subscriptions not removed | 410 Gone errors logged but subscription row not deleted; manager must re-subscribe |
