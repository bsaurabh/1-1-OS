# Unit 3: Meeting Ingestion — Infrastructure Design Plan

**Unit**: Unit 3: Meeting Ingestion
**Date**: 2026-03-02

---

## Execution Checklist

- [x] Step 1: Analyze functional design, NFR requirements, and NFR design artifacts
- [x] Step 2: Create this plan
- [x] Step 3: All infrastructure decisions pre-determined (no ambiguities)
- [x] Step 4: Generate infrastructure-design.md
- [x] Step 5: Generate deployment-architecture.md
- [x] Step 6: Present completion message and await approval

---

## Infrastructure Additions (Pre-determined)

**New external services**:
- OpenAI Whisper API — voice transcription
- Supabase Storage — transient audio file storage (private bucket `voice-recordings`)
- Browser Push (web-push + VAPID) — analysis completion notifications

**New Vercel function timeout configurations**:
- `POST /api/transcription/transcribe` → `maxDuration: 60`
- `GET /api/jobs/process-analysis` (cron) → `maxDuration: 60`
- `POST /api/meetings/[id]/upload` → `bodyParser: false` (formidable)

**DB migration required**:
- Add `retryCount INTEGER NOT NULL DEFAULT 0` to `analysis_jobs` table

**New environment variables (6)**:
- `OPENAI_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---
