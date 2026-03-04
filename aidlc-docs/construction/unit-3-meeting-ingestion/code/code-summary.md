# Code Summary — Unit 3: Meeting Ingestion

**Unit**: Unit 3: Meeting Ingestion
**Completed**: 2026-03-02
**Stories**: US-05 (Paste notes), US-06 (Upload file), US-07 (Voice recording), US-08 (Review transcription), US-17 (Confirm commitments)

---

## Files Generated

### Modified Files (3)

| File | Change |
|------|--------|
| `package.json` | Added 6 runtime deps + 2 devDeps |
| `prisma/schema.prisma` | Added `retryCount Int @default(0)` to `AnalysisJob` |
| `pages/api/jobs/process-analysis.ts` | Replaced Unit 1 scaffold with full cron handler |
| `pages/teammates/[id]/index.tsx` | Added "Add Meeting" button + `MeetingInputModal` |

### New Database Migration (1)

| File | Description |
|------|-------------|
| `prisma/migrations/20260302000000_add_retry_count_to_analysis_jobs/migration.sql` | `ALTER TABLE analysis_jobs ADD COLUMN retryCount INTEGER NOT NULL DEFAULT 0` |

### New Library Files (7)

| File | Exports | Pattern |
|------|---------|---------|
| `lib/storage.ts` | `createPresignedUploadUrl`, `downloadFile`, `deleteFile` | P-3.04, P-3.08 |
| `lib/fileParsing.ts` | `parseTextFromFile`, `ValidationError`, `ParseError` | P-3.05 |
| `lib/meetings.ts` | `ingestPaste`, `ingestUpload`, `ingestTranscription` | P-3.01 |
| `lib/transcription.ts` | `getAudioUploadUrl`, `transcribeAudio`, `discardAudio` | P-3.04 |
| `lib/analysisQueue.ts` | `enqueue`, `claimNextJob`, `processNext`, `handleFailure` | P-3.02, P-3.03 |
| `lib/commitments.ts` | `saveSuggested`, `confirm`, `dismiss`, `listSuggested` | — |
| `lib/notifications.ts` | `subscribe`, `unsubscribe`, `notifyAnalysisComplete`, `notifyAnalysisFailed` | P-3.06 |

### New Handler (1)

| File | Exports | Pattern |
|------|---------|---------|
| `handlers/meetingAnalysisHandler.ts` | `analyze`, `buildAnalysisPrompt`, `parseAnalysisResponse`, `onComplete`, `AnalysisParseError` | P-3.07 |

### New API Routes (11)

| File | Method | Auth | Timeout | Story |
|------|--------|------|---------|-------|
| `pages/api/meetings/[teammateId]/paste.ts` | POST | withAuth | 10s | US-05 |
| `pages/api/meetings/[teammateId]/upload.ts` | POST | withAuth | 10s (bodyParser off) | US-06 |
| `pages/api/meetings/[teammateId]/save-transcription.ts` | POST | withAuth | 10s | US-08 |
| `pages/api/meetings/[teammateId]/[meetingId].ts` | GET | withAuth | 10s | US-05–08 |
| `pages/api/transcription/start.ts` | GET | withAuth | 10s | US-07 |
| `pages/api/transcription/transcribe.ts` | POST | withAuth | **60s** | US-07 |
| `pages/api/transcription/[fileId].ts` | DELETE | withAuth | 10s | US-07, US-08 |
| `pages/api/commitments/[teammateId].ts` | GET | withAuth | 10s | US-17 |
| `pages/api/commitments/[id].ts` | PATCH | withAuth | 10s | US-17 |
| `pages/api/notifications/subscribe.ts` | POST/DELETE | withAuth | 10s | US-05–08 |
| `pages/api/jobs/process-analysis.ts` | GET | CRON_SECRET | **60s** | US-05–08 |

### New React Components (8)

| File | Props | Story |
|------|-------|-------|
| `components/meetings/AnalysisPendingBanner.tsx` | none | US-05–08 |
| `components/meetings/MeetingAnalysisResults.tsx` | `summary, tone, tags, themes, source` | US-05–08 |
| `components/meetings/PasteInput.tsx` | `teammateId, onSuccess` | US-05 |
| `components/meetings/FileUpload.tsx` | `teammateId, onSuccess` | US-06 |
| `components/meetings/TranscriptionReview.tsx` | `teammateId, fileId, initialText, onSuccess, onDiscard` | US-08 |
| `components/meetings/VoiceRecorder.tsx` | `teammateId, onSuccess` | US-07, US-08 |
| `components/meetings/MeetingInputModal.tsx` | `teammateId, onSuccess, onClose` | US-05–08 |
| `components/commitments/SuggestedCommitments.tsx` | `commitments, onChange` | US-17 |

### New Pages (1)

| File | SSR | Story |
|------|-----|-------|
| `pages/teammates/[id]/meeting/[meetingId].tsx` | Yes (withAuth + getServerSideProps) | US-05–08, US-17 |

### New Test Files (9)

| File | Tests |
|------|-------|
| `lib/fileParsing.test.ts` | .txt/.docx/.pdf extraction; ParseError; ValidationError |
| `lib/meetings.test.ts` | ingestPaste (short text, not found, success); ingestUpload; ingestTranscription |
| `lib/commitments.test.ts` | confirm (success, not found, wrong mgr); dismiss; listSuggested; saveSuggested |
| `lib/notifications.test.ts` | subscribe; unsubscribe; notifyAnalysisComplete (push, swallow errors) |
| `handlers/meetingAnalysisHandler.test.ts` | buildAnalysisPrompt; parseAnalysisResponse (JSON, regex, throws, tag filter); analyze |
| `pages/api/meetings/[teammateId]/paste.test.ts` | 405, 400 (short), 404 (no teammate), 200 |
| `pages/api/meetings/[teammateId]/upload.test.ts` | ValidationError; ParseError; success flow |
| `pages/api/commitments/[id].test.ts` | 405, 400 (bad action), confirm 200/404, dismiss 200/404 |
| `pages/api/jobs/process-analysis.test.ts` | 405, 401 (bad secret), 200 (no jobs), 200 (processed), 500 |

---

## Dependencies Added

### Runtime
```
openai@^4.52.0
web-push@^3.6.7
mammoth@^1.8.0
pdf-parse@^1.1.1
formidable@^3.5.1
@supabase/supabase-js@^2.43.0
```

### Dev
```
@types/web-push@^3.3.3
@types/pdf-parse@^1.1.4
```

### Install command
```bash
npm install openai web-push mammoth pdf-parse formidable @supabase/supabase-js
npm install --save-dev @types/web-push @types/pdf-parse
```

---

## Environment Variables Added (Unit 3)

| Variable | Purpose | Server/Client |
|----------|---------|---------------|
| `OPENAI_API_KEY` | Whisper transcription | Server only |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push (browser subscribe) | Client-safe |
| `VAPID_PRIVATE_KEY` | Web Push signing | Server only |
| `VAPID_SUBJECT` | VAPID identity (mailto:) | Server only |
| `SUPABASE_URL` | Supabase client | Server only |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin access | Server only |

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Save-First, Analyze-Async (P-3.01) | Meeting data never lost if Claude fails; decoupled ingestion from analysis latency |
| `FOR UPDATE SKIP LOCKED` (P-3.02) | Atomic job claim prevents double-processing when cron overlaps |
| retryCount on AnalysisJob (P-3.03) | Max 2 retries (3 total attempts) before permanent ANALYSIS_FAILED |
| Presigned URL audio (P-3.04) | Audio goes client → Supabase directly; Next.js never receives blob |
| In-memory file parsing (P-3.05) | mammoth + pdf-parse; no cloud storage needed for document ingestion |
| Notification failure isolation (P-3.06) | Push/email both in try/catch; ANALYSIS_COMPLETE status persisted before notifications |
| VALID_TAGS filter (P-3.07) | Claude output tags filtered against allowlist; invalid tags silently dropped |
| `{managerId}/{fileId}` path (P-3.08) | managerId from JWT (verified), fileId server-generated; prevents path traversal |
| VoiceRecorder 7-state machine (P-3.09) | IDLE→REQUESTING→RECORDING→UPLOADING→TRANSCRIBING→REVIEW→ERROR |

---

## Technical Debt Introduced

| ID | Item |
|----|------|
| TD-10 | No rate limiting on file upload (formidable enforces size but not frequency) |
| TD-11 | Orphaned audio if server crashes between upload and transcription |
| TD-12 | Push notifications require HTTPS (Vercel prod is fine; local dev needs ngrok) |
| TD-13 | 410 Gone push errors not auto-cleaned; manager must re-subscribe |
