# NFR Requirements — Unit 3: Meeting Ingestion

**Date**: 2026-03-02
**Unit**: Unit 3: Meeting Ingestion
**Stories**: US-05, US-06, US-07, US-08, US-17

---

## NFR-3.1: Performance

### Ingestion Endpoints

| Endpoint | Method | p95 Target | Notes |
|----------|--------|-----------|-------|
| `/api/meetings/[id]/paste` | POST | < 300ms | Validate + single DB write |
| `/api/meetings/[id]/upload` | POST | < 3s | Validate + in-memory file parse (mammoth / pdf-parse) + DB write |
| `/api/meetings/[id]/save-transcription` | POST | < 300ms | Validate + single DB write |
| `/api/transcription/start` | GET | < 500ms | Supabase Storage presigned URL generation |
| `/api/transcription/transcribe` | POST | < 60s | Storage download + Whisper API + Storage delete |
| `/api/transcription/[fileId]` | DELETE | < 1s | Supabase Storage delete |

### Commitment & Notification Endpoints

| Endpoint | Method | p95 Target | Notes |
|----------|--------|-----------|-------|
| `/api/commitments/[teammateId]` | GET | < 300ms | Filtered DB query (status=SUGGESTED) |
| `/api/commitments/[id]` | PATCH | < 300ms | Single DB update or delete |
| `/api/notifications/subscribe` | POST | < 300ms | DB upsert |
| `/api/notifications/subscribe` | DELETE | < 300ms | DB deleteMany |

### Polling & Cron

| Operation | Target | Notes |
|-----------|--------|-------|
| `GET /api/meetings/[id]/[meetingId]` (poll) | p95 < 200ms | Frequent polling (every 5s) — must be fast; single row DB read |
| `GET /api/jobs/process-analysis` (cron) | p95 < 60s | Job claim + Claude Sonnet analysis (~30s typical) + persist + notify |

### Claude API Calls (Meeting Analysis)

| Operation | Target | Notes |
|-----------|--------|-------|
| `claude-sonnet-4-6` meeting analysis | p95 < 40s end-to-end | Includes network, Sonnet inference, JSON response. Meeting notes are typically 300–1500 tokens; Sonnet typically 15–35s. |
| Cron timeout threshold | 60s hard cutoff | `maxDuration: 60` on `/api/jobs/process-analysis`. Jobs exceeding 60s are permanently abandoned (marked FAILED after next retry). |

### Whisper API Calls

| Operation | Target | Notes |
|-----------|--------|-------|
| OpenAI Whisper (`whisper-1`) transcription | p95 < 30s | Audio duration-dependent: 5-min recording ~8s, 30-min recording ~25s typical. Client shows spinner during transcription. |
| Transcription route timeout | 60s hard cutoff | `maxDuration: 60` on `POST /api/transcription/transcribe`. |

### Page Load

| Page | Target |
|------|--------|
| Meeting results page (SSR) | TTI < 3s (consistent with prior units) |
| Teammate page (modified — adds meeting modal) | TTI < 3s |

---

## NFR-3.2: Reliability

### Cron Job Retry Policy

- **Strategy**: Cron-based retry — jobs are NOT retried in-request. A failed job is marked `FAILED` with `retryCount` incremented; it will be re-claimed on the next cron tick (every 30s).
- **Max retries**: 2 (3 total attempts: `retryCount` 0, 1, 2).
- **Permanently failed**: After `retryCount >= 2`, `Meeting.status = ANALYSIS_FAILED`; manager notified via Resend email.
- **Job claim safety**: `FOR UPDATE SKIP LOCKED` prevents two concurrent cron invocations from double-claiming the same job.

```
Cron tick N:   Claim PENDING job (retryCount=0) → call Claude → FAILS → mark FAILED (retryCount=1)
Cron tick N+1: Claim FAILED job (retryCount=1) → call Claude → FAILS → mark FAILED (retryCount=2)
Cron tick N+2: Claim FAILED job (retryCount=2) → call Claude → FAILS → mark FAILED PERMANENTLY → notify manager
Cron tick N+3: Job NOT claimed (retryCount=2, status=FAILED) → no-op
```

### Whisper Transcription Failure Handling

- **On Supabase Storage download failure**: throw `TranscriptionError` → client shows "Transcription failed. Please paste your notes manually or try again."
- **On Whisper API failure**: throw `TranscriptionError` → same error message to client; audio file remains in storage until client explicitly discards.
- **No in-route retry for Whisper**: client can retry by clicking "Try Again" (resets to IDLE state).

### Notification Failure Isolation

- Both `webPush.sendNotification()` and Resend email calls are wrapped in `try/catch`.
- Errors are logged to console but **not propagated** to the cron job result.
- A failed push subscription (e.g., 410 Gone from the push service) does NOT cause the job to be marked FAILED.
- Analysis `Meeting.status = ANALYSIS_COMPLETE` is persisted **before** notifications fire.

### Audio File Lifecycle Guarantee

- Audio files are deleted immediately after successful Whisper transcription (`transcribe()` step 3).
- Audio files are deleted on explicit `discard()` call.
- If server crashes between audio upload and transcription, the file persists in storage (tracked as TD-11 — acceptable orphan for PoC).

### File Parsing Error Handling

- `.docx` parsing error (malformed file) → `ParseError` → 422 response.
- `.pdf` parsing error → `ParseError` → 422 response.
- Empty extracted text → `ParseError` → 422 response.
- DB save errors → `500 Internal Server Error` (consistent with Units 1–2 `INTERNAL_ERROR` constant).

---

## NFR-3.3: Security

### API Keys and Secrets

| Variable | Exposure | Usage |
|----------|---------|-------|
| `OPENAI_API_KEY` | Server-side only | Whisper transcription API |
| `VAPID_PRIVATE_KEY` | Server-side only | Signing push notifications |
| `VAPID_SUBJECT` | Server-side only | VAPID contact identifier |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only | Full storage access (presigned URLs, download, delete) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client bundle (safe) | Browser `pushManager.subscribe()` requires the public key |

**Critical**: `OPENAI_API_KEY`, `VAPID_PRIVATE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` must NEVER use the `NEXT_PUBLIC_` prefix. Exposing them client-side would allow unauthorized API access.

### File Upload Security

- **Dual validation** (belt-and-suspenders):
  - **Client-side**: Extension check + `file.size > 10MB` check before upload (fast UX feedback).
  - **Server-side**: MIME type check + extension check + size check via `formidable` `maxFileSize: 10 * 1024 * 1024`.
- **Formidable configuration**: `maxFiles: 1`, `maxFileSize: 10 * 1024 * 1024`, in-memory storage (no disk writes in serverless).
- **Next.js body parser**: Disabled for the upload route (`export const config = { api: { bodyParser: false } }`).

### Audio Storage Path Security

- Storage path: `{managerId}/{fileId}` where:
  - `managerId` comes from the verified session JWT (never from user input).
  - `fileId` is a server-generated `cuid()` (never user-supplied).
- Managers cannot access other managers' audio files — the service role key is used only server-side with session-validated paths.
- Bucket `voice-recordings` is **private** — no public read access.

### Input Handling

- Pasted text: no prompt injection protection (TD-06 from Unit 2 — consistent treatment).
- Meeting text embedded in Claude analysis prompt with teammate name/profile context. Teammate fields are validated at create/update time (Units 1–2 rules).
- Commitment text from Claude response is stored as-is (not re-embedded in prompts in this unit).

### Authorization

- All 11 API routes enforce `withAuth` (JWT session validation). Unauthenticated → 401.
- `managerId` always read from session, never from body or query.
- Cross-manager access → 404 (prevents ID enumeration, consistent with Units 1–2).

### Push Notification Security

- VAPID keys generated once at project setup (`web-push.generateVAPIDKeys()`).
- `VAPID_SUBJECT` is a `mailto:` address identifying the notification sender.
- Push subscriptions stored per manager — one active subscription at a time (BR-3.17 upsert semantics).
- No sensitive data included in push notification payload (only meeting completion status and teammate name).

---

## NFR-3.4: Scalability

### Cron Job Architecture

- **One job per cron invocation**: cron claims exactly one PENDING/retryable job per tick using `FOR UPDATE SKIP LOCKED`.
- Prevents Vercel function timeout from exceeding `maxDuration: 60`.
- At PoC scale (≤ 100 managers), this design handles peak load: if 10 managers submit meetings simultaneously, all jobs complete within 5 minutes (10 ticks × 30s interval).

### Document Processing (In-Memory Only)

- `.txt`, `.docx`, `.pdf` files are processed entirely in-memory — no cloud storage for documents.
- `mammoth` and `pdf-parse` operate on a `Buffer` (held in Next.js function memory for the duration of the request).
- Serverless function memory limit (Vercel): 1024MB. A 10MB PDF in memory with parsing overhead stays well under this limit.

### Supabase Storage (Audio Only)

- Audio files are stored transiently in Supabase Storage (minutes to seconds lifecycle).
- Only one active audio file per recording session; deleted immediately after transcription or discard.
- Storage bucket `voice-recordings` grows only if files are orphaned (TD-11 — periodic cleanup deferred).

### Database

- New table: `AnalysisJob` (with `retryCount` column added via migration).
- `Commitment` table used (defined in Unit 1 schema).
- `PushSubscription` table used (defined in Unit 1 schema).
- All queries include `managerId` filter for data isolation.
- No new indexes required beyond existing FKs at PoC scale.

### Stateless Analysis

- The cron handler is stateless — all state lives in DB (`AnalysisJob.status`, `Meeting.status`).
- Concurrent Vercel function invocations are safe: `FOR UPDATE SKIP LOCKED` prevents double-processing.

---

## NFR-3.5: Availability

- Inherits Units 1–2 availability targets:
  - Vercel: 99.99% uptime SLA
  - Supabase: 99.9% uptime SLA
- **OpenAI Whisper API**: No SLA; handled via client-side error state ("Transcription failed. Try Again.").
- **Claude API**: No SLA; handled via cron-based retry (up to 2 retries) + manager email on permanent failure.
- **Resend email**: Best-effort; failures swallowed (BR-3.15).
- **Web push**: Best-effort; failures swallowed (BR-3.15).
- **Degraded-mode availability**: Paste and Upload ingestion routes remain available even if Whisper, Claude, or notification services are down. Notes are always saved.

---

## NFR-3.6: Maintainability

### Handler Structure

- `handlers/meetingAnalysisHandler.ts` — Claude Sonnet analysis call; mirrors `interviewAIHandler.ts` pattern.
- `handlers/transcriptionHandler.ts` — OpenAI Whisper call; isolated service boundary.
- `lib/meetings.ts` — MeetingIngestionComponent business logic (validate, save, enqueue).
- `lib/transcription.ts` — TranscriptionComponent (presigned URL, transcribe, discard).
- `lib/analysisQueue.ts` — AnalysisJobQueue (enqueue, processNext, handleFailure).
- `lib/commitments.ts` — CommitmentTracker (saveSuggested, confirm, dismiss, listSuggested).
- `lib/notifications.ts` — NotificationComponent (subscribe, unsubscribe, notify).
- `lib/fileParsing.ts` — `parseTextFromFile` pure utility (mammoth + pdf-parse).

### Model Constants

```typescript
const ANALYSIS_MODEL = 'claude-sonnet-4-6'   // Meeting analysis
const WHISPER_MODEL  = 'whisper-1'            // Audio transcription
```

### Prompt Management

- Analysis prompt defined as a function `buildAnalysisPrompt(rawText, teammateName, profile)` in `handlers/meetingAnalysisHandler.ts`.
- Prompt is a code artifact — versioned with the codebase, not stored in DB.
- Tag taxonomy (`VALID_TAGS` constant) defined in `handlers/meetingAnalysisHandler.ts`; referenced in `parseAnalysisResponse` for silent filtering.

### Testability

- All handler functions accept optional injectable clients: `openai?: OpenAI`, `anthropic?: Anthropic`.
- `parseTextFromFile` is a pure function — unit testable with Buffer fixtures.
- `parseAnalysisResponse` is a pure function — unit testable with Claude response strings.
- `buildAnalysisPrompt` is a pure function — unit testable.
- Notification functions (`notifyAnalysisComplete`, `notifyAnalysisFailed`) accept optional `webPush` and `resend` clients for injection in tests.

### Logging

- Console logging only (consistent with Units 1–2).
- Log: Claude analysis errors, Whisper errors, notification failures, job claims.
- Do NOT log: meeting raw text, teammate profile data (PII — consistent with TD-02).

---

## NFR-3.7: Usability

### Meeting Ingestion UX

- **Paste tab**: Character count updates live; button disabled until ≥ 50 characters; "Analyzing…" button state during submission.
- **Upload tab**: Drag-and-drop zone; client-side file validation gives instant feedback before upload begins; "Upload & Analyze" button disabled until file selected.
- **Voice tab**: State machine with clear labels at each step (Recording / Uploading / Transcribing); elapsed timer during recording; recovery path from any error state.

### Analysis Pending UX

- Amber banner ("Analysis in progress — your notes are saved. This usually takes under 30 seconds.") shown immediately after ingestion.
- Auto-polling every 5s — no manual refresh required.
- On analysis complete: UI transitions to results view seamlessly.

### Analysis Results UX

- Summary sentence displayed prominently at top.
- Tone as a badge; tags as chips for quick scanning.
- Themes as a numbered list (title + description).
- Commitment review panel with Confirm / Edit / Dismiss per item.

### Push Notification UX

- Browser permission request triggered by manager opt-in (never automatically on page load).
- Notification body: "Your 1:1 with [Teammate Name] has been analyzed."
- Clicking the notification navigates to `/teammates/[id]`.

### Accessibility

- Consistent with Units 1–2: semantic HTML, labels on all form inputs, keyboard navigation.
- File drop zone includes keyboard-accessible file input (native `<input type="file">`).
- Voice recorder state labels exposed via `aria-label`.

---

## Technical Debt Additions (Unit 3)

| ID | Item | Priority |
|----|------|----------|
| TD-10 | No rate limiting on file upload endpoint (potential abuse via large file spam) | MEDIUM — acceptable for private PoC; add before public launch |
| TD-11 | Orphaned audio files if server crashes between Supabase Storage upload and transcription start | LOW — rare at PoC scale; could add scheduled cleanup job against storage |
| TD-12 | Browser push notifications require HTTPS in production (Vercel handles this); local dev requires manual HTTPS setup or push subscription test bypass | LOW — standard HTTPS requirement; Vercel production is already HTTPS |
| TD-13 | Expired push subscriptions (410 Gone from push service) not removed automatically; manager must re-subscribe | LOW — mitigated by upsert semantics; add cleanup on next push attempt later |

---

## NFR Summary Table

| Category | Requirement | Target / Decision |
|----------|-------------|-------------------|
| Performance | Paste / save-transcription / commit PATCH | p95 < 300ms |
| Performance | File upload (parsing overhead) | p95 < 3s |
| Performance | Presigned URL generation | p95 < 500ms |
| Performance | Whisper transcription | p95 < 30s (audio-length dependent) |
| Performance | Claude Sonnet meeting analysis | p95 < 40s |
| Performance | Analysis status polling | p95 < 200ms |
| Performance | Cron job end-to-end | p95 < 60s |
| Performance | maxDuration — transcribe route | 60s |
| Performance | maxDuration — cron route | 60s |
| Reliability | Cron retry strategy | Max 2 retries (3 total attempts) |
| Reliability | Claude failure — cron | Increment retryCount; notify on permanent failure |
| Reliability | Whisper failure | Client-side error state; "Try Again" resets to IDLE |
| Reliability | Notification failures | Caught and swallowed; analysis still completes |
| Reliability | Audio file guarantee | Deleted on transcribe success OR on discard |
| Security | OPENAI_API_KEY | Server-side env var only |
| Security | VAPID_PRIVATE_KEY | Server-side env var only |
| Security | NEXT_PUBLIC_VAPID_PUBLIC_KEY | Client-side safe (public key) |
| Security | SUPABASE_SERVICE_ROLE_KEY | Server-side env var only |
| Security | File upload validation | Dual: client extension+size + server MIME+extension+formidable limit |
| Security | Audio path isolation | `{managerId}/{fileId}` — managerId from session JWT only |
| Security | Auth | withAuth on all 11 new routes |
| Scalability | Cron throughput | 1 job/tick × 30s interval = ~2 jobs/min |
| Scalability | Document processing | In-memory only — no cloud storage for documents |
| Scalability | DB schema addition | AnalysisJob.retryCount (migration required) |
| Availability | Whisper failure | Graceful error state; paste fallback always available |
| Availability | Claude failure | Cron retry + permanent failure email notification |
| Maintainability | Handler files | 7 new lib/handler files, each with one responsibility |
| Maintainability | Model IDs | Named constants in handler files |
| Maintainability | Prompt management | `buildAnalysisPrompt` pure function in handler |
| Maintainability | Logging | Console only, no PII |
| Usability | Analysis delivery | Async with 5s polling + push/email notification |
| Usability | Recording flow | 7-state machine with clear recovery path |
