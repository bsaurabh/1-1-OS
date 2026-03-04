# Unit Test Execution — 1:1OS

**Date**: 2026-03-03
**Scope**: Units 1–5: Foundation through Tracker & Timeline — 32 test files, ~240 test cases

---

## Test Coverage Overview

| Test File | Covers | Test Cases |
|-----------|--------|-----------|
| `__tests__/lib/password.test.ts` | `hashPassword`, `verifyPassword`, `DUMMY_HASH` | 5 |
| `__tests__/lib/auth.test.ts` | `signSessionToken`, `verifySessionToken` | 4 |
| `__tests__/lib/cookies.test.ts` | `setSessionCookie`, `clearSessionCookie` | 3 |
| `__tests__/lib/apiError.test.ts` | `sendError`, `INTERNAL_ERROR` | 2 |
| `__tests__/api/register.test.ts` | POST /api/auth/register | 4 |
| `__tests__/api/login.test.ts` | POST /api/auth/login | 3 |
| `__tests__/api/logout.test.ts` | POST /api/auth/logout | 2 |
| `__tests__/api/forgot-password.test.ts` | POST /api/auth/forgot-password | 3 |
| `__tests__/api/reset-password.test.ts` | POST /api/auth/reset-password | 5 |
| **Unit 1 Total** | | **~31 test cases** |
| `handlers/interviewAIHandler.test.ts` | `nextQuestion()`, `generateProfile()`, Claude retry | 8 |
| `lib/teammates.test.ts` | `countPopulatedFields()`, CRUD (create, list, get, update, delete) | 17 |
| `pages/api/teammates/index.test.ts` | GET list, POST create — auth, validation, success, error | 10 |
| `pages/api/teammates/[id].test.ts` | GET, PATCH, DELETE — auth, validation, 404, method guard | 13 |
| `pages/api/interviews/[teammateId]/next.test.ts` | POST next question — method guard, auth, ownership, success, fallback | 8 |
| `pages/api/interviews/[teammateId]/complete.test.ts` | POST complete — method guard, auth, validation, success, warning, fallback | 11 |
| **Unit 2 Total** | | **~67 test cases** |
| `lib/fileParsing.test.ts` | `.txt`/`.docx`/`.pdf` extraction; `ParseError`; `ValidationError` | ~5 |
| `lib/meetings.test.ts` | `ingestPaste` (short text, not found, success); `ingestUpload`; `ingestTranscription` | ~5 |
| `lib/commitments.test.ts` | `saveSuggested`, `confirm`, `dismiss`, `listSuggested` (Unit 3) + `createCommitment`, `updateStatus`, `listOpen`, `listResolved`, `deleteCommitment` (Unit 5) | ~18 |
| `lib/notifications.test.ts` | `subscribe`; `unsubscribe`; `notifyAnalysisComplete` (push + swallow errors) | ~5 |
| `handlers/meetingAnalysisHandler.test.ts` | `buildAnalysisPrompt`; `parseAnalysisResponse` (JSON, regex, throws, tag filter); `analyze` | ~8 |
| `pages/api/meetings/[teammateId]/paste.test.ts` | 405, 400 (short), 404 (no teammate), 200 | 4 |
| `pages/api/meetings/[teammateId]/upload.test.ts` | `ValidationError`; `ParseError`; success flow | 3 |
| `pages/api/commitments/[id].test.ts` | confirm/dismiss (Unit 3) + done/carried_forward/dropped/DELETE (Unit 5) | ~12 |
| `pages/api/jobs/process-analysis.test.ts` | 405, 401 (bad secret), 200 (no jobs), 200 (processed), 500 | 5 |
| **Unit 3 Total** | | **~65 test cases** |
| `handlers/patternDetectionHandler.test.ts` | `buildPatternPrompt`; `parsePatternResponse` (valid/invalid/filtered); `detectPatterns`; `upsertPattern` (dedup + eviction) | ~14 |
| `handlers/coachingStrategyHandler.test.ts` | `parseFrameworkResponse`; `fallbackApproach`; `buildFrameworkSelectionPrompt`; `selectFramework` | ~10 |
| `handlers/briefGenerationHandler.test.ts` | `parseBriefResponse`; `buildFallback`; `formatBriefAsText`; `generateBrief` (EmptyHistoryError, success, fallback) | ~16 |
| `pages/api/brief/[teammateId]/generate.test.ts` | 405, 404, 422, 200 success, 200 fallback, 500, correct args | 7 |
| **Unit 4 Total** | | **~47 test cases** |
| `pages/api/commitments/[teammateId].test.ts` | GET (405/404/400/200-open/200-resolved); POST (400/400/201/409) | 9 |
| `lib/timeline.test.ts` | `listTimeline`; `buildGrowthSummaryPrompt`; `parseGrowthSummaryResponse`; `generateGrowthSummary` (EmptyHistoryError, success, null, parallel pre-fetch) | 10 |
| `pages/api/timeline/[teammateId].test.ts` | 405, 404, 200 with meetings | 3 |
| `pages/api/timeline/[teammateId]/summary.test.ts` | 405, 404, 422, 200 success, 200 null, 500, correct args | 7 |
| **Unit 5 Total** | | **~29 test cases** |
| **Grand Total (Units 1–5)** | | **~239 test cases** |

---

## Step 1: Run All Unit Tests

```bash
npm test
```

**Expected output**:
```
PASS  __tests__/lib/password.test.ts
PASS  __tests__/lib/auth.test.ts
PASS  __tests__/lib/cookies.test.ts
PASS  __tests__/lib/apiError.test.ts
PASS  __tests__/api/register.test.ts
PASS  __tests__/api/login.test.ts
PASS  __tests__/api/logout.test.ts
PASS  __tests__/api/forgot-password.test.ts
PASS  __tests__/api/reset-password.test.ts
PASS  handlers/interviewAIHandler.test.ts
PASS  lib/teammates.test.ts
PASS  pages/api/teammates/index.test.ts
PASS  pages/api/teammates/[id].test.ts
PASS  pages/api/interviews/[teammateId]/next.test.ts
PASS  pages/api/interviews/[teammateId]/complete.test.ts
PASS  lib/fileParsing.test.ts
PASS  lib/meetings.test.ts
PASS  lib/commitments.test.ts
PASS  lib/notifications.test.ts
PASS  handlers/meetingAnalysisHandler.test.ts
PASS  pages/api/meetings/[teammateId]/paste.test.ts
PASS  pages/api/meetings/[teammateId]/upload.test.ts
PASS  pages/api/commitments/[id].test.ts
PASS  pages/api/jobs/process-analysis.test.ts
PASS  handlers/patternDetectionHandler.test.ts
PASS  handlers/coachingStrategyHandler.test.ts
PASS  handlers/briefGenerationHandler.test.ts
PASS  pages/api/brief/[teammateId]/generate.test.ts
PASS  pages/api/commitments/[teammateId].test.ts
PASS  lib/timeline.test.ts
PASS  pages/api/timeline/[teammateId].test.ts
PASS  pages/api/timeline/[teammateId]/summary.test.ts

Test Suites: 32 passed, 32 total
Tests:       ~239 passed, ~239 total
```

---

## Step 2: Run Tests with Coverage

```bash
npm run test:coverage
```

**Target coverage thresholds** (Units 1–5):

| Module | Target Coverage |
|--------|----------------|
| `lib/password.ts` | 100% |
| `lib/auth.ts` | 100% |
| `lib/cookies.ts` | 90%+ |
| `lib/apiError.ts` | 100% |
| `pages/api/auth/register.ts` | 85%+ |
| `pages/api/auth/login.ts` | 85%+ |
| `pages/api/auth/logout.ts` | 100% |
| `pages/api/auth/forgot-password.ts` | 80%+ |
| `pages/api/auth/reset-password.ts` | 90%+ |
| `handlers/interviewAIHandler.ts` | 90%+ |
| `lib/teammates.ts` | 95%+ |
| `pages/api/teammates/index.ts` | 90%+ |
| `pages/api/teammates/[id].ts` | 90%+ |
| `pages/api/interviews/[teammateId]/next.ts` | 90%+ |
| `pages/api/interviews/[teammateId]/complete.ts` | 90%+ |
| `lib/fileParsing.ts` | 85%+ |
| `lib/meetings.ts` | 85%+ |
| `lib/commitments.ts` | 90%+ |
| `lib/notifications.ts` | 80%+ |
| `handlers/meetingAnalysisHandler.ts` | 90%+ |
| `pages/api/meetings/[teammateId]/paste.ts` | 85%+ |
| `pages/api/meetings/[teammateId]/upload.ts` | 80%+ |
| `pages/api/commitments/[id].ts` | 90%+ |
| `pages/api/jobs/process-analysis.ts` | 85%+ |
| `handlers/patternDetectionHandler.ts` | 90%+ |
| `handlers/coachingStrategyHandler.ts` | 85%+ |
| `handlers/briefGenerationHandler.ts` | 90%+ |
| `pages/api/brief/[teammateId]/generate.ts` | 85%+ |
| `pages/api/commitments/[teammateId].ts` | 85%+ |
| `lib/timeline.ts` | 90%+ |
| `pages/api/timeline/[teammateId].ts` | 85%+ |
| `pages/api/timeline/[teammateId]/summary.ts` | 85%+ |

---

## Step 3: Run Tests in Watch Mode (During Development)

```bash
npm run test:watch
```

Re-runs only affected tests on file change. Press `a` to run all tests.

---

## Key Behaviours Verified by Unit Tests

### Unit 1

#### Anti-Enumeration (Login — `login.test.ts`)
- Verifies `verifyPassword` is **always called** even when the email is not found
- Confirms identical `401` error message whether email exists or not

#### Atomic Token Consumption (`reset-password.test.ts`)
- Verifies `passwordResetToken.update` (marking `usedAt`) is called **before** `manager.update`
- Verifies used token returns 400 without updating password

#### Silent Email Failure (`forgot-password.test.ts`)
- Verifies response is always `200` even when `sendPasswordResetEmail` throws
- Confirms no error leakage to client

#### Cookie Security Flags (`cookies.test.ts`)
- Verifies `HttpOnly` and `SameSite=Lax` always present
- Verifies `Secure` flag absent in `development` environment

### Unit 2

#### isComplete Without Claude Call (`interviewAIHandler.test.ts`)
- Verifies `nextQuestion()` returns `{ isComplete: true }` when history has 7 turns **without** calling `client.messages.create`
- Guards against billing a Claude call that is never needed

#### Single-Retry on Transient Errors (`interviewAIHandler.test.ts`)
- Verifies that a 529/5xx error on first call triggers exactly one retry
- Verifies `client.messages.create` is called **exactly twice** on first-fail-then-succeed scenario
- Verifies that exhausted retries propagate the error (the caller handles the 503 fallback)

#### _rawAnswers Fallback (`interviewAIHandler.test.ts`)
- Verifies `generateProfile()` stores `{ _rawAnswers: conversationHistory }` when Claude returns unparseable JSON
- Verifies a `warning` field is present in the result so callers can surface degraded-mode messaging

#### Cross-Manager 404 (`teammates/[id].test.ts`)
- Verifies GET/PATCH/DELETE return `404` (not `403`) when teammate belongs to a different manager
- Confirms ownership is enforced via the DB `WHERE managerId = ?` clause — no data leakage

#### Profile JSONB Merge (`teammates.test.ts`)
- Verifies `updateTeammate()` spreads existing profile before applying new values
- Verifies untouched fields survive partial updates

#### Validation — Exactly 7 Turns (`complete.test.ts`)
- Verifies `POST /complete` returns `400` for 0, 1, 6, 8 turns
- Only 7 turns are accepted — prevents synthesis from incomplete or overly-long conversations

### Unit 3

#### Save-First, Analyze-Async (`meetings.test.ts`)
- Verifies `ingestPaste` writes the meeting row and enqueues an analysis job before returning
- Verifies the route returns `200` with `meetingId` without waiting for Claude

#### VALID_TAGS Allowlist Filter (`meetingAnalysisHandler.test.ts`)
- Verifies `parseAnalysisResponse` silently drops tags not in the `VALID_TAGS` set
- Confirms no 500 is thrown when Claude returns unexpected tags

#### Analysis Job Retry Cap (`jobs/process-analysis.test.ts`)
- Verifies that a job with `retryCount >= 2` is marked `ANALYSIS_FAILED` rather than re-enqueued
- Guards against infinite retry loops on malformed meeting content

#### Ownership-Scoped Confirm/Dismiss (`commitments/[id].test.ts`)
- Verifies `confirm`/`dismiss` return `404` when `managerId` does not match
- No commitment data is leaked to a foreign manager session

### Unit 4

#### Pattern Eviction at Capacity (`patternDetectionHandler.test.ts`)
- Verifies `upsertPattern()` evicts the oldest INFORMATIONAL → WATCH pattern when `count >= MAX_PATTERNS_PER_TEAMMATE`
- Guards against unbounded pattern table growth

#### Brief Graceful Degradation (`briefGenerationHandler.test.ts`)
- Verifies `generateBrief()` returns `{ brief: null, fallback }` (not a thrown error) when Claude call fails
- Confirms `BriefFallbackView` data is always available to the page render

#### EmptyHistoryError Propagation (`briefGenerationHandler.test.ts`, `generate.test.ts`)
- Verifies `generateBrief()` throws `EmptyHistoryError` when no meetings exist
- Verifies the route converts this to `422 { error: 'no_history' }` (not 500)

#### INFORMATIONAL Patterns Excluded from Brief (`briefGenerationHandler.test.ts`)
- Verifies `generateBrief()` filters out patterns with severity `INFORMATIONAL` before prompt construction
- Only `WATCH` and `ACTION_REQUIRED` patterns appear in the brief

### Unit 5

#### Duplicate Commitment Detection (`commitments.test.ts`)
- Verifies `createCommitment` returns `{ duplicate: true, existingId }` on case-insensitive text match against OPEN or CARRIED_FORWARD commitments
- Confirms no duplicate row is created

#### carryCount Atomic Increment (`commitments.test.ts`)
- Verifies `updateStatus(..., 'carried_forward')` uses `{ carryCount: { increment: 1 } }` — no read-modify-write race
- Verifies `done` and `dropped` actions do NOT increment `carryCount`

#### Graceful Growth Summary Degradation (`timeline.test.ts`, `summary.test.ts`)
- Verifies `generateGrowthSummary()` returns `null` (never throws) when Claude fails
- Verifies the route returns `200 { summary: null }` — the page shows a retry prompt instead of an error page

#### EmptyHistoryError on Zero Analyzed Meetings (`timeline.test.ts`, `summary.test.ts`)
- Verifies `generateGrowthSummary()` throws `EmptyHistoryError` if no meetings have status `ANALYSIS_COMPLETE`
- Verifies the route converts this to `422` — distinct from the null-on-Claude-failure 200 path

---

## Troubleshooting Failing Tests

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `Cannot find module '@/lib/...'` | Path aliases not resolved | Verify `jest.config.ts` `moduleNameMapper` |
| `SECRET_KEY not set` in auth tests | env not set in test | Tests set `process.env.SECRET_KEY` in `beforeEach` — check test setup |
| Prisma mock not applied | Mock hoisting issue | Move `jest.mock(...)` to top of file before imports |
| Timeout on `forgot-password` test | Async work after `res.json()` | Use `await new Promise(r => setTimeout(r, 10))` after handler call |
| `Cannot find module '@anthropic-ai/sdk'` | SDK not installed | Run `npm install` |
| `jest.requireActual` fails on interviewAIHandler mock | Circular import issue | Ensure `...jest.requireActual(...)` spread is inside the factory function |
| `res.status is not a function` in API tests | makeRes not returning mockReturnValue(res) | Ensure `res.status = jest.fn().mockReturnValue(res)` so chaining works |
| `Cannot find module 'openai'` in transcription tests | OpenAI SDK not installed | Run `npm install` (included in Unit 3 package.json update) |
| `EmptyHistoryError instanceof` check fails in summary route | Test mock class not matching | Ensure `EmptyHistoryError` is re-exported inside the `jest.mock('@/lib/timeline', ...)` factory so `instanceof` resolves to the same class reference |
| `mkdir -p pages/api/timeline/[teammateId]` fails in zsh | Glob expansion | Quote the path: `mkdir -p "pages/api/timeline/[teammateId]"` |
