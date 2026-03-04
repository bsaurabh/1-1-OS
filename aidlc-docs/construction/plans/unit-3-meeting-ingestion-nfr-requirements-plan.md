# Unit 3: Meeting Ingestion — NFR Requirements Plan

**Unit**: Unit 3: Meeting Ingestion
**Stories**: US-05, US-06, US-07, US-08, US-17
**Date**: 2026-03-02

---

## Execution Checklist

- [x] Step 1: Analyze functional design artifacts
- [x] Step 2: Create this plan with pre-filled questions
- [x] Step 3: Collect and analyze answers
- [x] Step 4: Generate nfr-requirements.md
- [x] Step 5: Generate tech-stack-decisions.md
- [x] Step 6: Present completion message and await approval

---

## Context Summary

**Unit 3 introduces significant new infrastructure** compared to Units 1–2:
- Three file-handling paths: paste (text), upload (.txt/.docx/.pdf), voice recording
- OpenAI Whisper API for audio transcription (new AI vendor)
- Supabase Storage for transient audio file lifecycle
- `mammoth` + `pdf-parse` for in-memory document text extraction
- Vercel cron job fully wired (was scaffold in Unit 1): processes one AnalysisJob per tick
- `web-push` with VAPID keys for browser push notifications (new notification channel)
- Resend email notifications (already in Unit 1, extended with 2 new templates)
- Atomic job claim via `FOR UPDATE SKIP LOCKED`
- Cron-based retry: max 2 retries (retryCount column — requires DB migration)

---

## NFR Questions (All Pre-filled)

---

**Q1 — New npm runtime dependencies**

Which packages should be added for Unit 3?

A) `openai`, `web-push`, `mammoth`, `pdf-parse`, `formidable`, `@supabase/supabase-js`
B) Same packages plus `busboy` instead of `formidable`
C) Same packages plus `multer` for file upload handling

[Answer]: A — `formidable` is the idiomatic choice for Next.js Pages Router multipart parsing (disable bodyParser, use formidable to stream to memory). `@supabase/supabase-js` is required for Supabase Storage presigned URLs, download, and delete operations — Prisma does not handle storage.

---

**Q2 — TypeScript type packages (devDependencies)**

Which `@types/*` packages are needed?

A) `@types/web-push`, `@types/pdf-parse`, `@types/formidable`
B) `@types/web-push`, `@types/pdf-parse` only (formidable v3 ships own types)
C) No additional type packages (all have built-in types)

[Answer]: B — `formidable` v3+ ships its own TypeScript types; `web-push` and `pdf-parse` do not — they require `@types/` packages. `mammoth` ships its own types in v1.7+. `openai` npm package ships its own TypeScript types. `@supabase/supabase-js` ships its own types.

---

**Q3 — New environment variables**

Which environment variables are required for Unit 3?

A) `OPENAI_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
B) `OPENAI_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
C) Only `OPENAI_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`

[Answer]: A — `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is required because the browser's `pushManager.subscribe({ applicationServerKey })` call happens client-side (in the Service Worker subscription flow), so the public key must be accessible in the browser bundle via `NEXT_PUBLIC_` prefix. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are needed for server-side Supabase Storage operations (presigned URL creation, file download, file deletion).

---

**Q4 — File upload multipart parsing approach**

How should `POST /api/meetings/[teammateId]/upload` parse the incoming multipart/form-data request?

A) Disable Next.js body parser (`bodyParser: false`) + use `formidable` to parse the multipart stream in-memory (store file in memory, not on disk) → extract buffer → call `parseTextFromFile(buffer, extension)`
B) Disable body parser + use `busboy` for lower-level streaming
C) Use Vercel Blob direct upload instead of streaming through the API route

[Answer]: A — `formidable` with `maxFileSize: 10 * 1024 * 1024` and `maxFiles: 1`; file stored in memory (`formidable` `InMemoryFile`); buffer extracted directly. This avoids temp disk files (not available in serverless) and keeps the implementation straightforward for a PoC.

---

**Q5 — Cron handler maxDuration**

What `maxDuration` is needed for the `/api/jobs/process-analysis` cron route?

A) `maxDuration: 60` — allows up to 60s for: job claim (~50ms) + load meeting (~50ms) + Claude Sonnet analysis (~30s typical, ~40s p95) + persist results (~100ms) + notifications (~500ms)
B) `maxDuration: 30` — same as interview routes
C) `maxDuration: 300` — maximum Vercel Pro limit

[Answer]: A — `maxDuration: 60` provides safe headroom. Claude Sonnet analysis of meeting notes can take 20–40s; combined with job claim, DB reads/writes, and notifications, 60s is a safe ceiling. Vercel Hobby supports up to 60s for non-edge functions.

---

**Q6 — Whisper transcription route maxDuration**

What `maxDuration` is needed for `POST /api/transcription/transcribe`?

A) `maxDuration: 60` — allows for: Supabase Storage download (~1s) + Whisper API call (~10–30s for typical meeting audio) + Supabase Storage delete (~500ms)
B) `maxDuration: 30`
C) `maxDuration: 10` (default)

[Answer]: A — `maxDuration: 60`. Whisper API latency scales with audio duration. A 30-minute meeting recording could take 20–30s for transcription. 60s provides adequate headroom.

---

**Q7 — Performance targets for new endpoints**

| Endpoint | Target |
|----------|--------|
| POST /api/meetings/[id]/paste | p95 < 300ms |
| POST /api/meetings/[id]/upload | p95 < 3s (file parsing overhead) |
| POST /api/meetings/[id]/save-transcription | p95 < 300ms |
| GET /api/transcription/start | p95 < 500ms |
| POST /api/transcription/transcribe | p95 < 60s |
| DELETE /api/transcription/[fileId] | p95 < 1s |
| GET /api/meetings/[id]/[meetingId] (poll) | p95 < 200ms |
| PATCH /api/commitments/[id] | p95 < 300ms |
| GET /api/commitments/[id] | p95 < 300ms |
| POST/DELETE /api/notifications/subscribe | p95 < 300ms |
| GET /api/jobs/process-analysis (cron) | p95 < 60s |

Are these targets appropriate?

A) Yes — all targets consistent with PoC scale and endpoint characteristics
B) Adjust upload target to p95 < 5s (larger files)
C) Adjust cron target to p95 < 30s (stricter)

[Answer]: A — targets are appropriate. Upload p95 < 3s covers .docx/.pdf parsing via mammoth/pdf-parse for typical meeting transcript files (≤ 10MB). Cron p95 < 60s matches the maxDuration limit.

---

**Q8 — Supabase Storage security for audio files**

How should the `voice-recordings` bucket be secured?

A) **Service role key on server + path convention** (`{managerId}/{fileId}`): presigned upload URLs generated server-side enforce path prefix; server always uses session `managerId` (never user-supplied) for storage paths; bucket is non-public (private); only server can access via service role key
B) Row Level Security (RLS) on Supabase Storage policies
C) Public bucket with obscure random paths

[Answer]: A — service role key approach; `managerId` in path comes from verified session JWT (not user input) so path tampering is impossible; private bucket ensures no direct browser access; simpler than RLS policies for a PoC.

---

**Q9 — Analysis result delivery model**

How are analysis results delivered to the client after the async cron job completes?

A) **Polling + push notification**: client polls `GET /api/meetings/[id]/[meetingId]` every 5s while `status === PENDING_ANALYSIS`; when complete, both a browser push notification (if subscribed) and a Resend email are sent; the polling loop catches the status change regardless
B) WebSocket connection kept open during analysis
C) SSE stream from the cron endpoint

[Answer]: A — polling + push/email is consistent with the async architecture; no WebSocket complexity needed at PoC scale; the 5s polling interval is imperceptible for a 10–30s analysis; notifications provide instant feedback if user navigates away.

---

**Q10 — Technical debt items for Unit 3**

Which new technical debt items should be tracked?

A) TD-10 (no rate limiting on file upload), TD-11 (orphaned audio files if server crash mid-upload), TD-12 (push requires HTTPS — dev environment needs manual verification), TD-13 (expired push subscriptions not cleaned up after 410 Gone)
B) Only TD-10 and TD-11
C) No new technical debt (everything covered)

[Answer]: A — all four items are real concerns at production scale; appropriate to track for a PoC. TD-11 is mitigated by the short audio lifetime (deleted immediately after transcription or discard); TD-13 is mitigated by the single-subscription-per-manager upsert pattern.

---
