# Unit 3: Meeting Ingestion — Functional Design Plan

**Unit**: Unit 3: Meeting Ingestion
**Stories**: US-05 (Paste notes), US-06 (Upload transcript file), US-07 (Voice recording + transcription), US-08 (Review & edit transcription), US-17 (Confirm AI-extracted commitments)
**Date**: 2026-03-02

---

## Execution Checklist

- [x] Step 1: Analyze unit context (unit-of-work.md, story-map, component-methods, schema)
- [x] Step 2: Clarifying questions presented to user
- [x] Step 3: Answers collected and analyzed for ambiguity
- [x] Step 4: Generate domain-entities.md
- [x] Step 5: Generate business-logic-model.md
- [x] Step 6: Generate business-rules.md
- [x] Step 7: Generate frontend-components.md
- [x] Step 8: Present completion message and await approval

---

## Context Summary

**Unit purpose**: Enable all three meeting ingestion methods (paste, file upload, voice recording), run AI analysis asynchronously via a Vercel cron job, extract commitments, and notify the manager on completion.

**Prisma models used** (all defined in Unit 1 schema):
- `Meeting { id, managerId, teammateId, rawText, source, status, themes, tags, summary, tone, createdAt, updatedAt }`
- `AnalysisJob { id, meetingId, status (PENDING|PROCESSING|COMPLETE|FAILED), error, createdAt, processedAt }`
- `Commitment { id, managerId, teammateId, meetingId?, text, owner, status (SUGGESTED|OPEN|...), carryCount, ... }`
- `PushSubscription { id, managerId, subscription Json, createdAt }`

**MeetingSource enum**: `PASTE | UPLOAD | VOICE`
**AnalysisStatus enum**: `PENDING_ANALYSIS | ANALYSIS_COMPLETE | ANALYSIS_FAILED`

**Key components**:
- `MeetingIngestionComponent` — ingestPaste, ingestUpload, ingestTranscription, enqueueAnalysis
- `TranscriptionComponent` — getAudioUploadUrl, transcribe, discard
- `MeetingAnalysisHandler` — analyze (themes, tags, tone, summary, commitments), onComplete
- `AnalysisJobQueue` — enqueue, processNext, handleFailure
- `CommitmentTracker` — saveSuggested, confirm, dismiss (suggested sub-set only in Unit 3)
- `NotificationComponent` — subscribe, unsubscribe, notifyAnalysisComplete

**API Routes to implement**:
- `POST /api/meetings/[teammateId]/paste`
- `POST /api/meetings/[teammateId]/upload`
- `POST /api/meetings/[teammateId]/save-transcription`
- `POST /api/transcription/start`
- `POST /api/transcription/transcribe`
- `DELETE /api/transcription/[fileId]`
- `GET /api/commitments/[teammateId]` (suggested only)
- `PATCH /api/commitments/[id]` (confirm / dismiss)
- `POST /api/notifications/subscribe`
- `DELETE /api/notifications/subscribe`
- `GET /api/jobs/process-analysis` (fully wired — replaces Unit 1 scaffold)

---

## Clarifying Questions

The following design decisions need resolution before generating artifacts. Pre-filled answers reflect the recommended approach for a Next.js PoC at ≤100 managers scale.

---

**Q1 — Document file parsing library**

When a manager uploads a `.docx` or `.pdf` file, the server must extract plain text. Which library approach should be used?

A) **Server-side in the Next.js API route** using `mammoth` (for .docx) and `pdf-parse` (for .pdf) — text extracted in memory, file never stored in Supabase Storage
B) Client-side extraction before upload (requires JS libraries in the browser)
C) Send raw binary to a separate parsing service

[Answer]: A — server-side extraction with `mammoth` and `pdf-parse`; documents are transient (only their text is persisted in `Meeting.rawText`); no cloud storage for document files

---

**Q2 — Audio transcription service**

The PRD specifies Whisper API for voice transcription. How should it be called?

A) **OpenAI Whisper API** directly (`openai` npm package) — audio uploaded to Supabase Storage first, then server downloads and sends to Whisper, then deletes from storage
B) Supabase Edge Function proxy to Whisper
C) AssemblyAI or other third-party transcription service

[Answer]: A — OpenAI Whisper API (`openai` npm package, `OPENAI_API_KEY` env var); audio stored in Supabase Storage during transcription then deleted; matches PRD spec

---

**Q3 — Audio upload flow (client → storage → transcribe)**

How does the client audio reach Supabase Storage for transcription?

A) Client POSTs raw audio blob to Next.js API → server streams to Supabase Storage → server calls Whisper → returns text
B) **Client calls `POST /api/transcription/start` → gets presigned upload URL → uploads directly to Supabase Storage** → calls `POST /api/transcription/transcribe` with fileId → server retrieves + sends to Whisper + deletes

[Answer]: B — presigned URL pattern; keeps large audio binaries off the Next.js serverless function's request body; cleaner separation of upload from transcription

---

**Q4 — Meeting AI analysis — prompt structure**

Claude needs to extract: themes, category tags, one-line summary, tone, and commitment statements. How many Claude calls?

A) **Single Claude call** returning a structured JSON object with all fields (themes, tags, tone, summary, commitments with attribution) — like the profile synthesis approach in Unit 2
B) Two calls: one for themes/summary/tags/tone, a second focused on commitment extraction
C) Four separate focused calls (one per output type)

[Answer]: A — single Claude call with a detailed system prompt instructing JSON output; uses `claude-sonnet-4-6` for analysis quality; template mirrors profile synthesis pattern

---

**Q5 — Tag taxonomy — fixed or open**

Category tags appear on meetings (e.g., for timeline filtering in Unit 5). Should tags be:

A) **Fixed predefined set** that Claude selects from: `growth`, `delivery`, `relationships`, `wellbeing`, `strategy`, `feedback`, `process`, `recognition` — Claude picks 1–3 applicable tags per meeting
B) Free-form: Claude generates any tags it deems appropriate
C) Two layers: fixed primary category + optional free-form sub-tag

[Answer]: A — fixed tag set of 8 categories; enables consistent filtering in Unit 5 timeline; Claude instructed to pick from the enumerated list in the prompt

---

**Q6 — Commitment attribution in the AI prompt**

When Claude extracts commitment statements, how does it determine owner (MANAGER vs TEAMMATE)?

A) **Claude determines attribution in the structured JSON response** — the prompt instructs it to use context clues ("I will..." → MANAGER, "[Teammate name] will..." → TEAMMATE, speaker context in transcripts)
B) Regex pre-processing: `I will...` → MANAGER, otherwise → TEAMMATE; Claude not involved in attribution
C) All extracted commitments default to MANAGER unless explicitly attributed in text

[Answer]: A — Claude handles attribution; its contextual understanding is superior to regex for natural conversational text; includes teammate name in the prompt for name-matching

---

**Q7 — Analysis job retry strategy**

If Claude fails during analysis (network error, 5xx, timeout), how does the job queue handle it?

A) **Retry at the next cron invocation** — failed jobs are marked FAILED immediately (no in-request retry), but a separate retry counter allows up to 2 retry attempts on subsequent cron ticks before permanently failing
B) In-request retry (1 retry with delay) like `callClaudeWithRetry()` in Unit 2; then mark FAILED
C) No retry — mark FAILED immediately on first error

[Answer]: A — cron-based retry with a `retryCount` counter; jobs with `retryCount < 2` and `status = FAILED` are re-picked on next cron tick; permanently failed after 2 attempts; manager notified on permanent failure

---

**Q8 — Push notification library**

Browser push notifications require VAPID keys and a server-side push library. Which approach?

A) **`web-push` npm package** with generated VAPID key pair (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` env vars) — notification sent from the `/api/jobs/process-analysis` cron handler after analysis completes
B) Use Supabase Realtime for in-app real-time updates instead of web push
C) Email only — skip browser push for PoC

[Answer]: A — `web-push` npm package; VAPID keys required; both browser push AND email (Resend) sent on analysis complete as per PRD

---

**Q9 — Meeting ingest — validation rules summary**

Confirming all validation constraints from the user stories:

A) Paste: min 50 characters (error if less)
B) Upload: `.txt`, `.docx`, `.pdf` only; max 10MB; error if wrong type or too large
C) Voice recording: browser MediaRecorder API; audio sent as blob; no server-side size limit (Whisper API limit is 25MB)
D) All: meeting saved to DB before analysis job is enqueued (save-first, analyze-async pattern)

[Answer]: All correct — A, B, C, D all confirmed; save-first pattern ensures notes are never lost even if analysis fails

---

**Q10 — Transcription review UI state**

After Whisper returns the transcribed text, what state does the UI present?

A) **Editable textarea pre-filled with the transcription** — manager can edit freely, then click "Save & Analyze" (triggers `POST /api/meetings/[teammateId]/save-transcription`) or "Discard" (triggers `DELETE /api/transcription/[fileId]`)
B) Read-only display with an "Edit" button to unlock editing
C) Inline diff showing original vs transcribed

[Answer]: A — editable textarea pre-filled with transcription; "Save & Analyze" and "Discard" are the two primary CTAs; matches US-08 acceptance criteria exactly
