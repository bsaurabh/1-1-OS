# Unit 3: Meeting Ingestion — Code Generation Plan

**Unit**: Unit 3: Meeting Ingestion
**Stories**: US-05 (Paste notes), US-06 (Upload transcript file), US-07 (Voice recording + transcription), US-08 (Review & edit transcription), US-17 (Confirm AI-extracted commitments)
**Date**: 2026-03-02
**Workspace root**: `/Users/saurabhbajaj/Desktop/testproject`

---

## Unit Context

| Item | Detail |
|------|--------|
| Stories | US-05, US-06, US-07, US-08, US-17 |
| Depends on | Unit 1 (Prisma schema, withAuth, AppLayout, apiError, lib/claude.ts), Unit 2 (teammates table, pages/teammates/[id]/index.tsx) |
| New runtime dependencies | `openai`, `web-push`, `mammoth`, `pdf-parse`, `formidable`, `@supabase/supabase-js` |
| New devDependencies | `@types/web-push`, `@types/pdf-parse` |
| New env variables | `OPENAI_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| DB migration | Add `retryCount Int @default(0)` to `AnalysisJob` model |
| Claude model | `claude-sonnet-4-6` for meeting analysis |
| Whisper model | `whisper-1` for audio transcription |
| Key patterns | Save-First Analyze-Async, FOR UPDATE SKIP LOCKED, Cron-Based Retry, Presigned URL Audio, In-Memory File Parsing, Notification Failure Isolation |

---

## Files to Create / Modify

| # | Path | Action | Stories |
|---|------|--------|---------|
| 1 | `package.json` | Modify — add 6 runtime deps + 2 devDeps | All |
| 2 | `prisma/schema.prisma` | Modify — add `retryCount` to `AnalysisJob` | US-05–08 |
| 3 | `prisma/migrations/{ts}_add_retry_count_to_analysis_jobs/migration.sql` | Create | US-05–08 |
| 4 | `lib/storage.ts` | Create — StorageService (presigned URL, download, delete) | US-07 |
| 5 | `lib/fileParsing.ts` | Create — parseTextFromFile (.txt/.docx/.pdf) | US-06 |
| 6 | `lib/meetings.ts` | Create — MeetingIngestionService (ingestPaste, ingestUpload, ingestTranscription, enqueueAnalysis) | US-05, US-06, US-07 |
| 7 | `lib/transcription.ts` | Create — TranscriptionService (getAudioUploadUrl, transcribeAudio, discardAudio) | US-07, US-08 |
| 8 | `lib/analysisQueue.ts` | Create — AnalysisJobQueue (enqueue, claimNextJob, processNext, handleFailure) | US-05–08 |
| 9 | `lib/commitments.ts` | Create — CommitmentTracker (saveSuggested, confirm, dismiss, listSuggested) | US-17 |
| 10 | `lib/notifications.ts` | Create — NotificationService (subscribe, unsubscribe, notifyAnalysisComplete, notifyAnalysisFailed) | US-05–08 |
| 11 | `handlers/meetingAnalysisHandler.ts` | Create — analyze(), buildAnalysisPrompt(), parseAnalysisResponse(), onComplete() | US-05–08 |
| 12 | `pages/api/meetings/[teammateId]/paste.ts` | Create — POST paste ingestion | US-05 |
| 13 | `pages/api/meetings/[teammateId]/upload.ts` | Create — POST file upload; bodyParser: false; formidable | US-06 |
| 14 | `pages/api/meetings/[teammateId]/save-transcription.ts` | Create — POST save reviewed transcription | US-08 |
| 15 | `pages/api/meetings/[teammateId]/[meetingId].ts` | Create — GET meeting status poll | US-05–08 |
| 16 | `pages/api/transcription/start.ts` | Create — GET presigned upload URL | US-07 |
| 17 | `pages/api/transcription/transcribe.ts` | Create — POST Whisper transcription; maxDuration: 60 | US-07 |
| 18 | `pages/api/transcription/[fileId].ts` | Create — DELETE discard audio | US-07, US-08 |
| 19 | `pages/api/commitments/[teammateId].ts` | Create — GET list SUGGESTED commitments | US-17 |
| 20 | `pages/api/commitments/[id].ts` | Create — PATCH confirm / dismiss | US-17 |
| 21 | `pages/api/notifications/subscribe.ts` | Create — POST subscribe + DELETE unsubscribe | US-05–08 |
| 22 | `pages/api/jobs/process-analysis.ts` | Modify — replace Unit 1 scaffold with fully-wired cron handler; maxDuration: 60 | US-05–08 |
| 23 | `components/meetings/AnalysisPendingBanner.tsx` | Create | US-05–08 |
| 24 | `components/meetings/MeetingAnalysisResults.tsx` | Create | US-05–08 |
| 25 | `components/commitments/SuggestedCommitments.tsx` | Create | US-17 |
| 26 | `components/meetings/PasteInput.tsx` | Create | US-05 |
| 27 | `components/meetings/FileUpload.tsx` | Create | US-06 |
| 28 | `components/meetings/TranscriptionReview.tsx` | Create | US-08 |
| 29 | `components/meetings/VoiceRecorder.tsx` | Create | US-07, US-08 |
| 30 | `components/meetings/MeetingInputModal.tsx` | Create — tab switcher (Paste / Upload / Record) | US-05–08 |
| 31 | `pages/teammates/[id]/meeting/[meetingId].tsx` | Create — analysis results page with polling | US-05–08, US-17 |
| 32 | `pages/teammates/[id]/index.tsx` | Modify — add "Add Meeting" button + MeetingInputModal | US-05–08 |
| 33 | `lib/fileParsing.test.ts` | Create | US-06 |
| 34 | `lib/meetings.test.ts` | Create | US-05, US-06 |
| 35 | `lib/commitments.test.ts` | Create | US-17 |
| 36 | `lib/notifications.test.ts` | Create | US-05–08 |
| 37 | `handlers/meetingAnalysisHandler.test.ts` | Create | US-05–08 |
| 38 | `pages/api/meetings/[teammateId]/paste.test.ts` | Create | US-05 |
| 39 | `pages/api/meetings/[teammateId]/upload.test.ts` | Create | US-06 |
| 40 | `pages/api/commitments/[id].test.ts` | Create | US-17 |
| 41 | `pages/api/jobs/process-analysis.test.ts` | Create | US-05–08 |
| 42 | `aidlc-docs/construction/unit-3-meeting-ingestion/code/code-summary.md` | Create | — |

**Total**: 42 steps (32 application files, 9 test files, 1 doc)

---

## Generation Checklist

### Dependencies & Config
- [x] Step 1: Modify `package.json` — add `openai`, `web-push`, `mammoth`, `pdf-parse`, `formidable`, `@supabase/supabase-js` to `dependencies`; add `@types/web-push`, `@types/pdf-parse` to `devDependencies`

### Database Schema & Migration
- [x] Step 2: Modify `prisma/schema.prisma` — add `retryCount  Int  @default(0)` field to `AnalysisJob` model
- [x] Step 3: Create `prisma/migrations/{timestamp}_add_retry_count_to_analysis_jobs/migration.sql` — `ALTER TABLE` statement

### Business Logic Layer
- [x] Step 4: Create `lib/storage.ts` — Supabase Storage client singleton; `createPresignedUploadUrl()`, `downloadFile()`, `deleteFile()` (silent on error)
- [x] Step 5: Create `lib/fileParsing.ts` — `parseTextFromFile(buffer, extension)` pure function; mammoth for .docx, pdf-parse for .pdf, Buffer.toString for .txt; throws `ValidationError` / `ParseError`
- [x] Step 6: Create `lib/meetings.ts` — `ingestPaste()`, `ingestUpload()` (calls fileParsing), `ingestTranscription()`, shared `enqueueAnalysis()`; all follow save-first pattern
- [x] Step 7: Create `lib/transcription.ts` — `getAudioUploadUrl()` (cuid + presigned URL), `transcribeAudio()` (download → Whisper → delete on success), `discardAudio()` (delete, silent)
- [x] Step 8: Create `lib/analysisQueue.ts` — `enqueue()`, `claimNextJob()` (raw `$queryRaw` FOR UPDATE SKIP LOCKED), `processNext()`, `handleFailure()` (retryCount increment + ANALYSIS_FAILED on permanent fail)
- [x] Step 9: Create `lib/commitments.ts` — `saveSuggested()`, `confirm()` (SUGGESTED→OPEN, optional editedText), `dismiss()` (delete), `listSuggested()`; all verify managerId ownership
- [x] Step 10: Create `lib/notifications.ts` — `webPush.setVapidDetails()` at module level; `subscribe()` (upsert), `unsubscribe()` (deleteMany), `notifyAnalysisComplete()` (push + email, both try/catch swallow), `notifyAnalysisFailed()` (email only, swallow)

### Handler Layer
- [x] Step 11: Create `handlers/meetingAnalysisHandler.ts` — `analyze()`, `buildAnalysisPrompt()` (pure), `parseAnalysisResponse()` (JSON.parse + regex fallback + AnalysisParseError), `onComplete()`; uses `callClaudeWithRetry` from Unit 2; VALID_TAGS constant; `ANALYSIS_MODEL = 'claude-sonnet-4-6'`; injectable `client?` for tests

### API Routes — Meeting Ingestion
- [x] Step 12: Create `pages/api/meetings/[teammateId]/paste.ts` — POST; withAuth; validate ≥50 chars; delegate to `ingestPaste`; return `{ meetingId }`
- [x] Step 13: Create `pages/api/meetings/[teammateId]/upload.ts` — POST; `bodyParser: false`; withAuth; formidable parse (maxFiles:1, maxFileSize:10MB); validate extension + extracted text; delegate to `ingestUpload`
- [x] Step 14: Create `pages/api/meetings/[teammateId]/save-transcription.ts` — POST; withAuth; validate non-empty; delegate to `ingestTranscription`; return `{ meetingId }`
- [x] Step 15: Create `pages/api/meetings/[teammateId]/[meetingId].ts` — GET; withAuth; return meeting `{ id, status, themes, tags, tone, summary, source, createdAt }` + commitments list
- [x] Step 16: Create `pages/api/transcription/start.ts` — GET; withAuth; delegate to `getAudioUploadUrl(managerId)`; return `{ uploadUrl, fileId }`
- [x] Step 17: Create `pages/api/transcription/transcribe.ts` — POST; `maxDuration: 60`; withAuth; `{ fileId }` body; delegate to `transcribeAudio`; return `{ text }`
- [x] Step 18: Create `pages/api/transcription/[fileId].ts` — DELETE; withAuth; delegate to `discardAudio`; return 204
- [x] Step 19: Create `pages/api/commitments/[teammateId].ts` — GET; withAuth; `listSuggested(managerId, teammateId)`; return `{ commitments }`
- [x] Step 20: Create `pages/api/commitments/[id].ts` — PATCH; withAuth; `{ action: 'confirm'|'dismiss', text? }` body; delegate to `confirm` or `dismiss`; return 200 or 404
- [x] Step 21: Create `pages/api/notifications/subscribe.ts` — POST (subscribe) + DELETE (unsubscribe); withAuth; return 200
- [x] Step 22: Modify `pages/api/jobs/process-analysis.ts` — replace scaffold with `AnalysisJobQueue.processNext()`; `maxDuration: 60`; validate `CRON_SECRET` Authorization header; return 200

### React Components
- [x] Step 23: Create `components/meetings/AnalysisPendingBanner.tsx` — amber banner + spinner; `data-testid="analysis-pending-banner"`
- [x] Step 24: Create `components/meetings/MeetingAnalysisResults.tsx` — summary, tone badge, tag chips, themes list, source indicator; data-testids per spec
- [x] Step 25: Create `components/commitments/SuggestedCommitments.tsx` — per-item Confirm/Edit/Dismiss; `PATCH /api/commitments/[id]`; inline edit; `onChange` callback; all-reviewed empty state; data-testids per spec
- [x] Step 26: Create `components/meetings/PasteInput.tsx` — textarea + char count (red < 50) + "Analyze" button (disabled < 50 chars); calls `POST /api/meetings/[id]/paste`; data-testids per spec
- [x] Step 27: Create `components/meetings/FileUpload.tsx` — drag-and-drop zone; `accept=".txt,.docx,.pdf"`; client-side size+ext pre-check; calls `POST /api/meetings/[id]/upload` (multipart); data-testids per spec
- [x] Step 28: Create `components/meetings/TranscriptionReview.tsx` — pre-filled editable textarea; char count; "Save & Analyze" → `POST save-transcription`; "Discard" → `DELETE transcription/[fileId]`; data-testids per spec
- [x] Step 29: Create `components/meetings/VoiceRecorder.tsx` — 7-state machine (IDLE→REQUESTING→RECORDING→UPLOADING→TRANSCRIBING→REVIEW→ERROR); timer mm:ss; renders TranscriptionReview in REVIEW state; data-testids per spec
- [x] Step 30: Create `components/meetings/MeetingInputModal.tsx` — modal with 3 tabs (Paste/Upload/Record); `activeTab` state; routes child onSuccess to parent; data-testids per spec

### Pages
- [x] Step 31: Create `pages/teammates/[id]/meeting/[meetingId].tsx` — `getServerSideProps` + withAuth; loads meeting + commitments(SUGGESTED); polling every 5s while `PENDING_ANALYSIS`; renders AnalysisPendingBanner / MeetingAnalysisResults+SuggestedCommitments / error banner based on status
- [x] Step 32: Modify `pages/teammates/[id]/index.tsx` — add `isMeetingModalOpen` state; "Add Meeting" button (`data-testid="add-meeting-button"`); `MeetingInputModal` with `handleMeetingSuccess` → router.push to meeting page

### Tests
- [x] Step 33: Create `lib/fileParsing.test.ts` — test .txt/. docx/.pdf extraction (mock mammoth + pdf-parse); empty file → ParseError; unsupported extension → ValidationError
- [x] Step 34: Create `lib/meetings.test.ts` — test ingestPaste (< 50 chars → error, success), ingestUpload (bad type, too large, empty text, success), ingestTranscription (empty text, success); mock prisma + fileParsing
- [x] Step 35: Create `lib/commitments.test.ts` — test confirm (success, not found → null, wrong managerId → null), dismiss (success, not found), listSuggested; mock prisma
- [x] Step 36: Create `lib/notifications.test.ts` — test subscribe (upsert), unsubscribe; test notifyAnalysisComplete (push success, push failure swallowed, email failure swallowed); mock webPush + resend + prisma
- [x] Step 37: Create `handlers/meetingAnalysisHandler.test.ts` — test buildAnalysisPrompt (pure), parseAnalysisResponse (valid JSON, regex fallback, throws), analyze (success flow, Claude failure → throws, tag filtering); injectable Anthropic client
- [x] Step 38: Create `pages/api/meetings/[teammateId]/paste.test.ts` — test auth (401), < 50 chars (400), ownership (404), success (200 + meetingId); makeRes() pattern
- [x] Step 39: Create `pages/api/meetings/[teammateId]/upload.test.ts` — test auth (401), bad extension (400), too large (400), empty text (422), success (200); mock formidable + fileParsing
- [x] Step 40: Create `pages/api/commitments/[id].test.ts` — test auth (401), confirm (200 → OPEN), dismiss (200 → deleted), not found (404); makeRes() pattern
- [x] Step 41: Create `pages/api/jobs/process-analysis.test.ts` — test missing CRON_SECRET (401), no jobs (200 empty), job claimed + analyzed (200), handleFailure called on Claude error; mock AnalysisJobQueue

### Documentation
- [x] Step 42: Create `aidlc-docs/construction/unit-3-meeting-ingestion/code/code-summary.md`

---

## Story Traceability

| Story | Implementation Steps |
|-------|---------------------|
| US-05 — Paste meeting notes | Steps 6, 8–12, 15, 22–24, 26, 30–32, 34, 38 |
| US-06 — Upload transcript file | Steps 1, 5–6, 8, 13, 15, 22–24, 27, 30–32, 33–34, 39 |
| US-07 — Voice recording + transcription | Steps 1, 4, 7, 8, 16–18, 22–24, 29, 30–32 |
| US-08 — Review & edit transcription | Steps 7–8, 14, 15, 22–24, 28–32 |
| US-17 — Confirm AI-extracted commitments | Steps 9, 19–20, 25, 31, 35, 40 |

---

## Directory Structure After Unit 3

```
/                                          (workspace root)
├── handlers/
│   ├── interviewAIHandler.ts              (Unit 2)
│   ├── interviewAIHandler.test.ts         (Unit 2)
│   ├── meetingAnalysisHandler.ts          [NEW Step 11]
│   └── meetingAnalysisHandler.test.ts     [NEW Step 37]
├── lib/
│   ├── storage.ts                         [NEW Step 4]
│   ├── fileParsing.ts                     [NEW Step 5]
│   ├── fileParsing.test.ts                [NEW Step 33]
│   ├── meetings.ts                        [NEW Step 6]
│   ├── meetings.test.ts                   [NEW Step 34]
│   ├── transcription.ts                   [NEW Step 7]
│   ├── analysisQueue.ts                   [NEW Step 8]
│   ├── commitments.ts                     [NEW Step 9]
│   ├── commitments.test.ts                [NEW Step 35]
│   ├── notifications.ts                   [NEW Step 10]
│   ├── notifications.test.ts              [NEW Step 36]
│   ├── auth.ts, prisma.ts, ...            (Units 1–2)
│   └── teammates.ts                       (Unit 2)
├── components/
│   ├── meetings/                          [NEW directory]
│   │   ├── AnalysisPendingBanner.tsx      [NEW Step 23]
│   │   ├── MeetingAnalysisResults.tsx     [NEW Step 24]
│   │   ├── PasteInput.tsx                 [NEW Step 26]
│   │   ├── FileUpload.tsx                 [NEW Step 27]
│   │   ├── TranscriptionReview.tsx        [NEW Step 28]
│   │   ├── VoiceRecorder.tsx              [NEW Step 29]
│   │   └── MeetingInputModal.tsx          [NEW Step 30]
│   ├── commitments/                       [NEW directory]
│   │   └── SuggestedCommitments.tsx       [NEW Step 25]
│   ├── teammates/                         (Unit 2)
│   ├── interview/                         (Unit 2)
│   └── AppLayout.tsx                      (Unit 1)
├── pages/
│   ├── teammates/
│   │   └── [id]/
│   │       ├── index.tsx                  [MODIFIED Step 32]
│   │       ├── interview.tsx              (Unit 2)
│   │       └── meeting/
│   │           └── [meetingId].tsx        [NEW Step 31]
│   ├── api/
│   │   ├── meetings/
│   │   │   └── [teammateId]/
│   │   │       ├── paste.ts               [NEW Step 12]
│   │   │       ├── paste.test.ts          [NEW Step 38]
│   │   │       ├── upload.ts              [NEW Step 13]
│   │   │       ├── upload.test.ts         [NEW Step 39]
│   │   │       ├── save-transcription.ts  [NEW Step 14]
│   │   │       └── [meetingId].ts         [NEW Step 15]
│   │   ├── transcription/
│   │   │   ├── start.ts                   [NEW Step 16]
│   │   │   ├── transcribe.ts              [NEW Step 17]
│   │   │   └── [fileId].ts                [NEW Step 18]
│   │   ├── commitments/
│   │   │   ├── [teammateId].ts            [NEW Step 19]
│   │   │   ├── [id].ts                    [NEW Step 20]
│   │   │   └── [id].test.ts              [NEW Step 40]
│   │   ├── notifications/
│   │   │   └── subscribe.ts               [NEW Step 21]
│   │   ├── jobs/
│   │   │   ├── process-analysis.ts        [MODIFIED Step 22]
│   │   │   └── process-analysis.test.ts   [NEW Step 41]
│   │   └── auth/, teammates/, interviews/ (Units 1–2)
├── prisma/
│   ├── schema.prisma                      [MODIFIED Step 2]
│   └── migrations/
│       ├── {existing}/                    (Unit 1)
│       └── {ts}_add_retry_count.../       [NEW Step 3]
│           └── migration.sql
└── package.json                           [MODIFIED Step 1]
```
