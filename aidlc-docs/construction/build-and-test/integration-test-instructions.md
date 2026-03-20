# Integration Test Instructions — 1:1OS

**Date**: 2026-03-19 (updated)
**Scope**: Units 1–7 — auth, teammate profiles, meeting ingestion, intelligence engine, tracker & timeline, design critique, AI Excel insights

---

## Prerequisites

- All 5 units built and passing unit tests
- `.env.local` configured with a **development** Supabase project and all 13 required variables
- Development server running (`npm run dev`) OR tests run against the built app
- Supabase storage bucket `audio-uploads` created and accessible

---

## Integration Test Environment Setup

Integration tests run against the real Supabase development database (no Docker needed — Supabase is remote).

```bash
# Ensure migrations are applied to dev Supabase
npx prisma migrate deploy

# Start the dev server (leave running in a separate terminal)
npm run dev
```

---

## Scenario 1: Full Registration Flow

**Tests**: US-01 end-to-end

**Steps**:
1. POST `http://localhost:3000/api/auth/register` with `{ email: "test@example.com", password: "password123" }`
2. Verify response: `200 { managerId: "<id>" }`
3. Verify `Set-Cookie` header contains `session=<jwt>; HttpOnly; SameSite=Lax`
4. Verify row exists in `managers` table: `SELECT * FROM managers WHERE email = 'test@example.com'`
5. Verify `passwordHash` starts with `$2a$12$` (bcrypt cost 12)

**Expected DB state**: 1 manager row created, email stored lowercase.

**Cleanup**: `DELETE FROM managers WHERE email = 'test@example.com'`

---

## Scenario 2: Login → Session → Logout Flow

**Tests**: US-02 end-to-end

**Steps**:
1. Register a manager (Scenario 1)
2. POST `/api/auth/login` with `{ email: "test@example.com", password: "password123" }`
3. Verify: `200 { managerId }` + `Set-Cookie: session=<jwt>`
4. GET `/dashboard` with the `session` cookie — verify `200` (not redirect)
5. POST `/api/auth/logout` with the `session` cookie
6. Verify response: `200 { ok: true }` + `Set-Cookie: session=; Max-Age=0`
7. GET `/dashboard` without cookie — verify redirect to `/auth/login`

**Cleanup**: Delete test manager row.

---

## Scenario 3: Wrong Credentials (Anti-Enumeration)

**Tests**: US-02 security behaviour

**Steps**:
1. POST `/api/auth/login` with `{ email: "nonexistent@example.com", password: "anything" }`
2. Verify: `401 { error: "Incorrect email or password." }`
3. POST `/api/auth/login` with `{ email: "test@example.com", password: "wrongpassword" }` (existing user)
4. Verify: `401 { error: "Incorrect email or password." }` — **same message**
5. Compare response times: both should be approximately equal (~250ms bcrypt cost)

---

## Scenario 4: Full Password Reset Flow

**Tests**: US-16 end-to-end

**Steps**:
1. Register `reset-test@example.com`
2. POST `/api/auth/forgot-password` with `{ email: "reset-test@example.com" }`
3. Verify: `200 { message: "If an account exists..." }`
4. Query `password_reset_tokens` table: verify a row with `usedAt IS NULL` and `expiresAt > now()`
5. Copy `tokenHash` from DB, reverse-lookup the raw token (in tests: intercept Resend call to capture `resetUrl`)
6. POST `/api/auth/reset-password` with `{ token: <rawToken>, newPassword: "newPassword123" }`
7. Verify: `200 { message: "Password updated. Please log in." }`
8. Verify `password_reset_tokens` row: `usedAt IS NOT NULL`
9. Verify old password no longer works: POST `/api/auth/login` with old password → `401`
10. Verify new password works: POST `/api/auth/login` with "newPassword123" → `200`

**Cleanup**: Delete test manager row (cascades to tokens).

---

## Scenario 5: Reset Token Expiry

**Tests**: US-16 edge case

**Steps**:
1. Register `expiry-test@example.com`
2. Manually insert an expired token into `password_reset_tokens`:
   ```sql
   INSERT INTO password_reset_tokens ("id", "managerId", "tokenHash", "expiresAt")
   VALUES (
     'test-tok-1',
     '<managerId>',
     sha256('expired-raw-token'::bytea)::text,
     now() - interval '1 hour'
   );
   ```
3. POST `/api/auth/reset-password` with `{ token: "expired-raw-token", newPassword: "newpass123" }`
4. Verify: `400 { error: "This link has expired. Please request a new one." }`

**Cleanup**: Delete test manager and token rows.

---

## Scenario 6: Reset Token Single-Use Enforcement

**Tests**: US-16 reuse prevention

**Steps**:
1. Complete a successful password reset (Scenario 4)
2. Attempt to use the same raw token again
3. POST `/api/auth/reset-password` with the same token
4. Verify: `400 { error: "This link is no longer valid." }`

---

## Scenario 7: Cron Endpoint Authorization

**Tests**: Cron scaffold security

**Steps**:
1. GET `/api/jobs/process-analysis` with no `Authorization` header
2. Verify: `401 { error: "Unauthorized" }`
3. GET `/api/jobs/process-analysis` with `Authorization: Bearer wrong-secret`
4. Verify: `401 { error: "Unauthorized" }`
5. GET `/api/jobs/process-analysis` with `Authorization: Bearer <CRON_SECRET value from .env.local>`
6. Verify: `200 { processed: 0 }`

---

## Scenario 8: Create Teammate + AI Interview → Profile Synthesis

**Tests**: US-03 full flow (Unit 1 auth + Unit 2 teammate + Anthropic API)

**Prerequisites**:
- `.env.local` with `ANTHROPIC_API_KEY` set
- Dev server running (`npm run dev`)
- Authenticated session (complete Scenario 2 first)

**Steps**:
1. POST `/api/teammates` with `{ name: "Chirag", role: "Designer" }` and `session` cookie
2. Verify: `201 { id: "<id>", name: "Chirag", role: "Designer" }`
3. Verify row exists in `teammates` table: `SELECT * FROM teammates WHERE name = 'Chirag'`
4. POST `/api/interviews/<id>/next` with `{ conversationHistory: [], latestAnswer: "" }`
5. Verify: `200 { questionIndex: 1, area: "strengths", question: "...", isComplete: false }`
6. Submit 6 more turns (POST `/next` with growing `conversationHistory`)
7. After 7th POST `/next` — verify `{ isComplete: true }` is returned
8. POST `/api/interviews/<id>/complete` with `{ conversationHistory: [<7 turns>] }`
9. Verify: `200 { profile: { strengths: "...", growthAreas: "...", ... } }` — all 7 fields populated
10. Verify `teammates` DB row: `profile` JSONB column is updated

**Expected DB state**: `teammates.profile` contains all 7 synthesized fields (not `_rawAnswers`).

**Cleanup**: `DELETE FROM teammates WHERE name = 'Chirag'`

---

## Scenario 9: Auth Guard on Teammate API

**Tests**: US-03 security — no cross-manager data access

**Steps**:
1. Register two managers: `manager-a@example.com` and `manager-b@example.com`
2. Login as Manager A → create teammate "Alice"
3. Note the teammate ID
4. Login as Manager B → GET `/api/teammates/<Alice's ID>`
5. Verify: `404 { error: "Not found." }` (not 403, not 200)
6. Login as Manager B → PATCH `/api/teammates/<Alice's ID>` with `{ name: "Hacked" }`
7. Verify: `404 { error: "Not found." }`
8. Login as Manager B → DELETE `/api/teammates/<Alice's ID>`
9. Verify: `404 { error: "Not found." }`
10. Login as Manager A → GET `/api/teammates/<Alice's ID>` — verify `200` (Alice still exists, unchanged)

**Cleanup**: Delete both manager rows.

---

## Scenario 10: Profile Edit (Manual Update via PATCH)

**Tests**: US-04 end-to-end manual profile editing

**Steps**:
1. Authenticated as manager — POST `/api/teammates` to create `{ name: "Sam", role: "PM" }`
2. GET `/api/teammates/<id>` — verify `profileCompleteness: 1` (role only)
3. PATCH `/api/teammates/<id>` with `{ profile: { strengths: "Strategic thinker" } }`
4. Verify: `200` with `profileCompleteness: 2`
5. PATCH `/api/teammates/<id>` with `{ profile: { growthAreas: "Needs to delegate more" } }`
6. Verify: `200` with `profileCompleteness: 3` — and `strengths` still present (JSONB merge preserved)
7. GET `/api/teammates/<id>` — verify both `strengths` and `growthAreas` present

**Expected**: Profile JSONB accumulates fields without overwriting existing ones.

**Cleanup**: `DELETE FROM teammates WHERE name = 'Sam'`

---

## Scenario 11: Claude 503 Fallback Path

**Tests**: US-03 resilience — AI unavailable does not block profile creation

**Setup**: Temporarily set `ANTHROPIC_API_KEY=invalid-key` to trigger auth errors from Anthropic.

**Steps**:
1. Create a teammate via POST `/api/teammates`
2. POST `/api/interviews/<id>/next` with `{ conversationHistory: [], latestAnswer: "" }`
3. Verify: `503 { fallback: true, message: "AI interview unavailable..." }`
4. Confirm teammate row still exists in DB (teammate was not deleted)
5. PATCH `/api/teammates/<id>` with manual profile data — verify `200` with profile saved

**Expected**: Fallback path allows manual profile entry without breaking the teammate record.

**Cleanup**: Restore `ANTHROPIC_API_KEY`, delete test teammate.

---

## Unit 7 Integration Scenarios

### Scenario 12: Excel Upload → Analysis → Persistence

**Tests**: Full happy path — file in, dashboard saved to DB

**Prerequisites**: Dev server running, valid `ANTHROPIC_API_KEY`, `excel_analyses` table migrated

**Steps**:
1. Login and get session cookie
2. POST `/api/insights/upload` with a multipart `.xlsx` file containing columns: `Item Name`, `Status`, `Size`, `Completed Date`, `Revenue Impact`
3. Verify: `201` with `{ id, metrics, insights, recommendations }`
4. Confirm `insights` array has ≥ 3 strings
5. Confirm `metrics.delivery.completionRate` is a number 0–100
6. GET `/api/insights` — verify the new analysis appears in the list
7. GET `/api/insights/<id>` — verify full analysis returned with correct `managerId`

**Expected**: End-to-end flow produces and persists a complete analysis.

**Cleanup**: `DELETE FROM excel_analyses WHERE id = '<id>'`

---

### Scenario 13: Schema Auto-Detection Miss → Manual Mapping → Analysis

**Tests**: `needsMapping` fallback path

**Steps**:
1. POST `/api/insights/upload` with a file using non-standard column names (`Task`, `State`, `T-Shirt Size`)
2. Verify: `200` with `{ needsMapping: true, columns: [...], detectedSchema, sheetNames }`
3. Re-POST `/api/insights/upload` with same file + `schemaOverride: { itemName: "Task", status: "State", size: "T-Shirt Size" }`
4. Verify: `201` with full analysis result (no `needsMapping`)

**Expected**: Manual mapping override produces a complete analysis identical to auto-detected flow.

---

### Scenario 14: Multi-User Data Isolation

**Tests**: Row-level isolation — manager A cannot read manager B's analyses

**Steps**:
1. Login as Manager A, upload file, note `analysisId`
2. Login as Manager B
3. GET `/api/insights/<analysisId>` as Manager B
4. Verify: `404`
5. DELETE `/api/insights/<analysisId>` as Manager B
6. Verify: `404`
7. GET `/api/insights` as Manager B — verify Manager A's analysis is NOT in the list

**Expected**: All insight routes enforce `managerId` ownership.

---

### Scenario 15: Export Download

**Tests**: CSV/Excel export produces a valid file

**Steps**:
1. Upload and analyse a file, get `analysisId`
2. GET `/api/insights/export?id=<analysisId>`
3. Verify: `200` with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
4. Verify: `Content-Disposition` header contains `attachment; filename=`
5. Parse the response buffer as XLSX — confirm it has ≥ 3 sheets (Delivery, Time & Throughput, Business Impact)

**Expected**: Export returns a valid multi-sheet .xlsx file.

---

### Scenario 16: File Size Limit Enforcement

**Steps**:
1. POST `/api/insights/upload` with a file > 10MB
2. Verify: `400` or formidable's built-in file size rejection

**Expected**: Oversized files are rejected gracefully.

---

## Running Integration Tests with a Test Script

For automated integration testing, use a tool such as `supertest` (for API-level testing against the Next.js dev server) or `curl` commands:

```bash
# Example: Scenario 1 with curl
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"curl-test@example.com","password":"password123"}' \
  -i

# Expected: HTTP/1.1 200 OK with Set-Cookie header and { "managerId": "..." }
```

---

## Unit 3 Integration Scenarios

### Scenario 12: Paste Meeting → Analysis Queue → ANALYSIS_COMPLETE

**Tests**: US-05 end-to-end (Unit 1 auth + Unit 3 meeting ingestion + cron)

**Prerequisites**:
- Dev server running; `ANTHROPIC_API_KEY` set
- Authenticated session with at least one teammate

**Steps**:
1. POST `/api/meetings/<teammateId>/paste` with `{ text: "Sprint review: we discussed sprint goals. Team aligned on Q2 commitments." }`
2. Verify: `200 { meetingId: "<id>", status: "ANALYSIS_PENDING" }`
3. Verify `meetings` row in DB: `status = 'ANALYSIS_PENDING'`, `rawText` stored
4. Verify `analysis_jobs` row created: `meetingId = <id>`, `status = 'PENDING'`
5. Trigger cron: GET `/api/jobs/process-analysis` with correct `Authorization: Bearer <CRON_SECRET>`
6. Verify: `200 { processed: 1 }`
7. Verify `meetings` row: `status = 'ANALYSIS_COMPLETE'`, `summary`, `tone`, `tags`, `themes` all populated
8. GET `/api/meetings/<teammateId>/<meetingId>` — verify `200` with analysis fields

**Expected DB state**: `analysis_jobs.status = 'ANALYSIS_COMPLETE'`; `meetings.status = 'ANALYSIS_COMPLETE'`

**Cleanup**: Delete test meeting and analysis job rows.

---

### Scenario 13: Analysis Job Retry → ANALYSIS_FAILED

**Tests**: US-07/US-08 resilience — cron retry cap

**Setup**: Temporarily set `ANTHROPIC_API_KEY=invalid-key` so cron analysis always fails.

**Steps**:
1. POST `/api/meetings/<teammateId>/paste` with valid text
2. Note the `meetingId` and the analysis job ID
3. GET `/api/jobs/process-analysis` (Bearer token) — first attempt fails
4. Verify: `analysis_jobs.retryCount = 1`, `status = 'PENDING'`
5. GET `/api/jobs/process-analysis` — second attempt fails
6. Verify: `analysis_jobs.retryCount = 2`, `status = 'PENDING'`
7. GET `/api/jobs/process-analysis` — third attempt (retryCount already 2 = max)
8. Verify: `analysis_jobs.status = 'ANALYSIS_FAILED'`; `meetings.status = 'ANALYSIS_FAILED'`
9. GET `/api/jobs/process-analysis` again — verify the failed job is NOT re-processed: `200 { processed: 0 }`

**Expected**: After 3 total attempts the job is permanently marked FAILED and no longer claimed.

**Cleanup**: Restore `ANTHROPIC_API_KEY`; delete test rows.

---

### Scenario 14: Pattern Detection After ≥2 Analyzed Meetings

**Tests**: US-09 end-to-end (Unit 3 analysis + Unit 4 pattern detection)

**Prerequisites**: `ANTHROPIC_API_KEY` set; teammate with profile exists.

**Steps**:
1. Paste and fully analyze **two** meetings for the same teammate (run cron after each)
2. Verify `meetings` table has 2 rows with `status = 'ANALYSIS_COMPLETE'` for the teammate
3. Verify `patterns` table: rows created for the teammate with severity and tag data
4. GET `/api/teammates/<id>` — verify `patterns` array is populated in the response
5. Navigate to `/teammates/<id>` — verify `PatternList` renders pattern cards

**Expected**: Pattern detection fires inside `onComplete()` (chained, isolated) and writes to `patterns` table.

**Note**: Pattern dedup — paste two nearly identical meetings and verify only one pattern row is created (upsert behaviour).

**Cleanup**: Delete test meetings, analysis jobs, and pattern rows.

---

### Scenario 15: Pre-Meeting Brief Generation (US-10)

**Tests**: US-10 end-to-end (Unit 3 analysis + Unit 4 brief)

**Prerequisites**: Teammate with ≥1 ANALYSIS_COMPLETE meeting and an established profile.

**Steps**:
1. POST `/api/brief/<teammateId>/generate`
2. Verify: `200 { brief: { contextSummary, coachingFocus, followUpQuestions, uncomfortableQuestion, ... }, fallback: null }`
3. Verify `brief.coachingFocus` is a non-empty string
4. Verify `brief.followUpQuestions` is an array with ≥1 entry
5. Navigate to `/teammates/<id>/brief` — verify `BriefView` renders all sections

**Expected**: Brief generation calls Haiku (framework selection) then Sonnet (brief synthesis) in sequence.

**Cleanup**: No DB state to clean (brief is not persisted).

---

### Scenario 16: Brief Generation → Claude Fallback (US-10 Resilience)

**Tests**: US-10 graceful degradation — P-4.03

**Setup**: Temporarily set `ANTHROPIC_API_KEY=invalid-key`.

**Steps**:
1. Ensure teammate has ≥1 ANALYSIS_COMPLETE meeting
2. POST `/api/brief/<teammateId>/generate`
3. Verify: `200 { brief: null, fallback: { contextSummary: "...", commitments: [...] } }` — NOT a 500
4. Navigate to `/teammates/<id>/brief` — verify `BriefFallbackView` renders (not a blank page or error)

**Expected**: `BriefFallbackView` always has data; the page degrades gracefully without throwing.

**Cleanup**: Restore `ANTHROPIC_API_KEY`.

---

### Scenario 17: Commitment Lifecycle — Create, Carry Forward, Resolve (US-14, US-15)

**Tests**: US-14 + US-15 end-to-end

**Prerequisites**: Authenticated session; teammate exists.

**Steps**:
1. POST `/api/commitments/<teammateId>` with `{ text: "Schedule weekly sync", owner: "MANAGER" }` → verify `201 { commitment: { id, status: "OPEN" } }`
2. Duplicate check: POST same text again → verify `409 { duplicate: true, existingId: "<id>" }`
3. GET `/api/commitments/<teammateId>?status=open` → verify commitment appears
4. PATCH `/api/commitments/<id>` with `{ action: "carried_forward" }` → verify `200 { commitment: { status: "CARRIED_FORWARD", carryCount: 1 } }`
5. PATCH `/api/commitments/<id>` with `{ action: "carried_forward" }` again → verify `carryCount: 2`
6. GET `/api/commitments/<teammateId>?status=open` → confirm commitment still appears (CARRIED_FORWARD is in open list)
7. PATCH `/api/commitments/<id>` with `{ action: "done" }` → verify `200 { commitment: { status: "DONE" } }`
8. GET `/api/commitments/<teammateId>?status=open` → confirm commitment no longer in open list
9. GET `/api/commitments/<teammateId>?status=resolved` → confirm commitment appears in resolved list

**Expected DB state**: Final row has `status = 'DONE'`, `carryCount = 2`.

**Cleanup**: `DELETE FROM commitments WHERE text = 'Schedule weekly sync'`

---

### Scenario 18: Growth Timeline + Summary Generation (US-13)

**Tests**: US-13 end-to-end

**Prerequisites**: Teammate with ≥1 ANALYSIS_COMPLETE meeting; `ANTHROPIC_API_KEY` set.

**Steps**:
1. GET `/api/timeline/<teammateId>` → verify `200 { meetings: [{ id, status, summary, tags, ... }] }`
2. Verify meetings appear in reverse-chronological order (newest first)
3. Navigate to `/teammates/<id>/timeline` — verify tag chips render for each tag; "All" chip is active
4. Click a tag chip — verify the meeting list filters to only meetings with that tag (client-side, no new API call)
5. POST `/api/timeline/<teammateId>/summary` → verify `200 { summary: { narrative, keyThemes, growthSignals, coachingGaps } }` (or `{ summary: null }` if Claude fails — P-5.02)
6. If `summary` is non-null, verify `GrowthSummaryPanel` renders with all 4 sections

**EmptyHistoryError case**: If no ANALYSIS_COMPLETE meetings exist for the teammate, POST `/api/timeline/<teammateId>/summary` → verify `422 { error: "no_history" }`

**Cleanup**: No DB state to clean (growth summary is not persisted).
