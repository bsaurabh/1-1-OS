# Business Rules — Unit 3: Meeting Ingestion

**Date**: 2026-03-02
**Unit**: Unit 3: Meeting Ingestion

---

## BR-3.01 — Paste Input Minimum Length

**Rule**: Pasted meeting text must be at least 50 characters after trimming whitespace.

**When violated**: `POST /api/meetings/[teammateId]/paste` returns `400 { error: "Please add more detail — at least 50 characters required for meaningful analysis." }`

**Rationale**: Prevents analysis of content too sparse to yield meaningful insights (US-05 acceptance criteria).

---

## BR-3.02 — Uploaded File Type Restriction

**Rule**: Only `.txt`, `.docx`, and `.pdf` files are accepted for upload.

**Detection**: Check file MIME type AND file extension. If either indicates an unsupported format, reject immediately.

**When violated**: `400 { error: "Only .txt, .docx, and .pdf files are supported." }`

**Rationale**: Parser libraries (`mammoth`, `pdf-parse`) only support these formats; prevents runtime parse failures (US-06).

---

## BR-3.03 — Uploaded File Size Limit

**Rule**: Uploaded files must be ≤ 10MB.

**When violated**: `400 { error: "File size exceeds 10MB limit. Please upload a smaller file." }`

**Rationale**: Prevents serverless function memory exhaustion; 10MB is sufficient for any text transcript (US-06).

---

## BR-3.04 — Extracted Text Must Be Non-Empty

**Rule**: After file parsing, if the extracted text (trimmed) is empty, the upload is rejected.

**When violated**: `422 { error: "No readable text found in file. Please check the file and try again." }`

**Rationale**: An empty extraction (e.g., scanned image PDF) cannot be analyzed.

---

## BR-3.05 — Meeting Ownership Authorization

**Rule**: A manager can only ingest meetings for teammates they own. `managerId` from the session JWT must match `teammate.managerId`.

**When violated**: `404 { error: "Not found." }` — 404 not 403 to prevent ID enumeration.

**Rationale**: Cross-manager data isolation (applied consistently across all routes).

---

## BR-3.06 — Save-First, Analyze-Async

**Rule**: A `Meeting` record (with `status = PENDING_ANALYSIS`) is persisted to the database BEFORE the `AnalysisJob` is enqueued.

**Implication**: If analysis fails or the server crashes after saving but before enqueueing, the raw text is still preserved. The manager can see their notes immediately.

**Rationale**: US-05 fallback scenario: "Your notes are saved." — this only holds if the save is unconditional.

---

## BR-3.07 — One AnalysisJob Per Meeting

**Rule**: The `AnalysisJob.meetingId` column has a UNIQUE constraint. Only one job record can exist per meeting.

**Implication**: `enqueue()` will throw a DB unique constraint error if called twice for the same meeting. The calling code must guard against this (not retry enqueue on save).

---

## BR-3.08 — Job Claim Must Be Atomic

**Rule**: The cron handler claims one job using `FOR UPDATE SKIP LOCKED` to prevent two concurrent cron invocations from processing the same job.

**Eligibility criteria** for claiming:
1. `status = PENDING`, OR
2. `status = FAILED` AND `retryCount < 2`

**Implication**: A job with `status = PROCESSING` is never re-claimed — it will be stuck only if the Vercel function crashes mid-run (acceptable at PoC scale; no dead-letter handling required).

---

## BR-3.09 — Maximum Analysis Retry Count

**Rule**: An analysis job is retried at most 2 times (3 total attempts: initial + 2 retries).

| `retryCount` | Meaning |
|-------------|---------|
| 0 | Initial attempt (never tried yet) |
| 1 | First retry (previous attempt failed) |
| 2 | Second retry — if this fails too, permanently failed |

**When permanently failed**: `Meeting.status = ANALYSIS_FAILED`; manager notified via email.

**Rationale**: Balances resilience (transient Claude outages) with avoiding endless retry loops.

---

## BR-3.10 — Audio Storage: Bucket and Path Convention

**Rule**: Audio files are stored in Supabase Storage bucket `voice-recordings` under path `{managerId}/{fileId}`.

**Lifecycle**:
1. Created via presigned URL (client uploads directly)
2. Read by server during `transcribe()` call
3. Deleted immediately after successful transcription OR after `discard()` call

**Rule**: Audio files MUST be deleted after transcription or discard — no orphaned audio files allowed.

---

## BR-3.11 — Whisper Audio Format

**Rule**: Audio submitted for transcription may be `audio/webm` or `audio/mp4` (the two formats produced by browser `MediaRecorder`). Both are accepted by OpenAI Whisper `whisper-1`.

**File size**: No explicit server-side limit for voice recordings. Whisper API accepts up to 25MB.

---

## BR-3.12 — Analysis Tag Selection

**Rule**: Claude must select 1–3 tags from exactly this fixed set:

```
growth | delivery | relationships | wellbeing | strategy | feedback | process | recognition
```

Tags outside this set are silently dropped during `parseAnalysisResponse()`. If no valid tags are present after filtering, `tags` defaults to `[]`.

**Rationale**: Consistent taxonomy enables tag-based filtering in Unit 5 timeline.

---

## BR-3.13 — Commitment Attribution Defaults

**Rule**: When Claude's attribution for a commitment is ambiguous or absent, default to `MANAGER`.

**Priority order** for attribution:
1. Explicit first-person indicator ("I will...", "I'll...") → `MANAGER`
2. Explicit teammate name reference ("[teammateName] will...") → `TEAMMATE`
3. Second-person ("You will...") in context of manager speaking to teammate → `TEAMMATE`
4. Ambiguous or no clear indicator → `MANAGER` (default)

**Rationale**: Manager is more likely to be tracking their own commitments; defaulting to `MANAGER` errs on the side of manager accountability.

---

## BR-3.14 — Commitment Confirm: Status Transition

**Rule**: Only a commitment with `status = SUGGESTED` can be confirmed or dismissed.

| Action | Pre-condition | Post-state |
|--------|--------------|-----------|
| Confirm | `status = SUGGESTED` | `status = OPEN` |
| Dismiss | `status = SUGGESTED` | Record deleted |
| Confirm with edit | `status = SUGGESTED` | `status = OPEN`, `text = editedText` |

**When violated** (e.g., trying to confirm an already-open commitment): `404 { error: "Not found." }`

**Rationale**: Prevents double-confirm or confirming commitments that were already processed.

---

## BR-3.15 — Notification Failure Isolation

**Rule**: Browser push and email notification failures MUST NOT propagate to the cron job result or cause the job to be marked as failed.

**Implementation**: Both `webPush.sendNotification()` and Resend calls are wrapped in try/catch. Errors are logged but swallowed.

**Rationale**: Notification delivery is best-effort at PoC scale; analysis completion should succeed even if the manager's push subscription has expired.

---

## BR-3.16 — Transcription Review Text Validation

**Rule**: The `reviewedText` submitted via `POST /api/meetings/[teammateId]/save-transcription` must be non-empty after trimming.

**When violated**: `400 { error: "Meeting text cannot be empty." }`

**Rationale**: Prevents saving a blank meeting record that would yield meaningless analysis.

---

## BR-3.17 — Push Subscription Upsert (One Per Manager)

**Rule**: A manager has at most one active push subscription at any time. Calling `subscribe()` again replaces the previous subscription (upsert semantics).

**Rationale**: Managers may switch browsers or reinstall the app — the old subscription becomes invalid and should be replaced.

---

## Summary Table

| Rule | Scope | HTTP Status on Violation |
|------|-------|--------------------------|
| BR-3.01 | Paste min length | 400 |
| BR-3.02 | File type | 400 |
| BR-3.03 | File size | 400 |
| BR-3.04 | Empty parsed text | 422 |
| BR-3.05 | Ownership | 404 |
| BR-3.06 | Save-first | Invariant — not a user-facing error |
| BR-3.07 | One job per meeting | DB constraint — server 500 if violated |
| BR-3.08 | Atomic claim | DB-level (FOR UPDATE SKIP LOCKED) |
| BR-3.09 | Max 2 retries | Handled in cron — no user-facing error |
| BR-3.10 | Audio lifecycle | Invariant — no user-facing error |
| BR-3.11 | Audio format | Whisper error surfaced as 503 fallback |
| BR-3.12 | Tag taxonomy | Silent filter in parser |
| BR-3.13 | Commitment defaults | Claude prompt instruction |
| BR-3.14 | Status transition | 404 |
| BR-3.15 | Notification isolation | Logged + swallowed |
| BR-3.16 | Transcription non-empty | 400 |
| BR-3.17 | Subscription upsert | Upsert — no error |
