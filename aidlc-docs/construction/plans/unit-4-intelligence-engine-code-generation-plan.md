# Unit 4: Intelligence Engine — Code Generation Plan

**Unit**: Unit 4: Intelligence Engine
**Stories**: US-09 (View patterns), US-10 (Generate brief), US-11 (Regenerate/copy brief), US-12 (Coaching framework)
**Date**: 2026-03-02
**Workspace root**: `/Users/saurabhbajaj/Desktop/testproject`

---

## Unit Context

| Item | Detail |
|------|--------|
| Stories | US-09, US-10, US-11, US-12 |
| Depends on | Unit 1 (Prisma schema, withAuth, AppLayout, apiError, lib/claude.ts), Unit 2 (@anthropic-ai/sdk, callClaudeWithRetry pattern), Unit 3 (meetingAnalysisHandler.onComplete(), patterns table) |
| New runtime dependencies | None (all packages already installed) |
| New env variables | None (all 13 vars already configured) |
| DB migration | None (patterns table already in Unit 1 schema) |
| Claude models | `claude-haiku-4-5-20251001` (pattern detection, framework selection), `claude-sonnet-4-6` (brief generation) |
| Key patterns | P-4.01 Chained Side-Effect Isolation, P-4.02 Parallel DB Pre-fetch, P-4.03 Graceful Degradation, P-4.04 Tiered Model Selection, P-4.05 Bounded Collection Eviction, P-4.06 Client-Side Async Shell, P-4.07 Pure Text Serializer |

---

## Files to Create / Modify

| # | Path | Action | Stories |
|---|------|--------|---------|
| 1 | `handlers/patternDetectionHandler.ts` | Create — detectPatterns(), buildPatternPrompt(), parsePatternResponse(), upsertPattern() | US-09 |
| 2 | `handlers/coachingStrategyHandler.ts` | Create — selectFramework(), buildFrameworkSelectionPrompt(), parseFrameworkResponse(), fallbackApproach() | US-12 |
| 3 | `handlers/briefGenerationHandler.ts` | Create — generateBrief(), buildBriefPrompt(), parseBriefResponse(), buildFallback(), formatBriefAsText() | US-10, US-11 |
| 4 | `handlers/meetingAnalysisHandler.ts` | Modify — add detectPatterns() chain in onComplete() (P-4.01) | US-09 |
| 5 | `pages/api/brief/[teammateId]/generate.ts` | Create — POST brief generation route; maxDuration: 30 | US-10, US-11, US-12 |
| 6 | `components/patterns/PatternList.tsx` | Create — two empty states + PatternCard list | US-09 |
| 7 | `components/patterns/PatternCard.tsx` | Create — severity badge + expandable evidence | US-09 |
| 8 | `components/brief/BriefView.tsx` | Create — full brief display with all sections | US-10, US-11 |
| 9 | `components/brief/BriefFallbackView.tsx` | Create — fallback with retry button | US-10 |
| 10 | `components/brief/CoachingApproachCard.tsx` | Create — framework name + rationale + actions | US-12 |
| 11 | `components/brief/QuestionList.tsx` | Create — numbered follow-up questions | US-10 |
| 12 | `components/brief/CommitmentListMini.tsx` | Create — compact read-only commitment list | US-10 |
| 13 | `components/brief/PatternSignals.tsx` | Create — WATCH + ACTION_REQUIRED signals | US-10 |
| 14 | `pages/teammates/[id]/brief.tsx` | Create — SSR shell + client-side brief fetch; regenerate + copy | US-10, US-11, US-12 |
| 15 | `pages/teammates/[id]/index.tsx` | Modify — add patterns SSR reads, PatternList, "Prepare for 1:1" button | US-09 |
| 16 | `handlers/patternDetectionHandler.test.ts` | Create — unit tests for handler, prompt builder, parser, upsert | US-09 |
| 17 | `handlers/coachingStrategyHandler.test.ts` | Create — unit tests for selectFramework, parseFrameworkResponse, fallback | US-12 |
| 18 | `handlers/briefGenerationHandler.test.ts` | Create — unit tests for generateBrief, parseBriefResponse, fallback, formatBriefAsText | US-10, US-11 |
| 19 | `pages/api/brief/[teammateId]/generate.test.ts` | Create — API route tests (auth, ownership, 422, 200 success, 200 fallback) | US-10, US-11 |
| 20 | `aidlc-docs/construction/unit-4-intelligence-engine/code/code-summary.md` | Create — documentation summary | — |

**Total**: 20 steps (15 application files, 4 test files, 1 doc)

---

## Generation Checklist

### Handlers (Business Logic)

- [x] Step 1: Create `handlers/patternDetectionHandler.ts`
  - `detectPatterns(teammateId, managerId, client?)` — main entry point
  - `buildPatternPrompt(meetingSummaries, tagFrequencies, teammateName)` — exported, testable
  - `parsePatternResponse(text)` — exported, testable; filters VALID_SEVERITIES
  - `upsertPattern(teammateId, detected)` — count check, dedup (BR-4.04), eviction (P-4.05, BR-4.20)
  - Constants: `PATTERN_MODEL`, `VALID_SEVERITIES`, `MAX_PATTERNS_PER_TEAMMATE = 10`
  - Export: `PatternParseError`
  - Early return if < 2 meetings (BR-4.01)
  - Injectable `client?: Anthropic` for tests

- [x] Step 2: Create `handlers/coachingStrategyHandler.ts`
  - `selectFramework(teammate, recentPatterns, openCommitments, client?)` — main entry point
  - `buildFrameworkSelectionPrompt(teammateName, profile, patterns, commitments)` — exported
  - `parseFrameworkResponse(text)` — exported; validates framework in VALID_FRAMEWORKS
  - `fallbackApproach()` — returns generic approach (BR-4.14)
  - Constants: `FRAMEWORK_MODEL`, `VALID_FRAMEWORKS`
  - Injectable `client?: Anthropic` for tests

- [x] Step 3: Create `handlers/briefGenerationHandler.ts`
  - `generateBrief(managerId, teammateId, client?)` — main entry point; P-4.02 parallel fetch; P-4.03 fallback
  - `buildBriefPrompt(context)` — exported, testable
  - `parseBriefResponse(text)` — exported; validates BR-4.08 required fields
  - `buildFallback(commitments, lastMeeting)` — exported (BR-4.09)
  - `formatBriefAsText(brief, teammateName)` — exported pure function (P-4.07, US-11)
  - Constants: `BRIEF_MODEL`, `MAX_MEETINGS_FOR_BRIEF = 10`
  - Export: `EmptyHistoryError`, `BriefParseError`
  - Injectable `client?: Anthropic` for tests
  - `CoachingStrategyHandler.selectFramework()` called as sub-step

- [x] Step 4: Modify `handlers/meetingAnalysisHandler.ts`
  - Add `import { detectPatterns } from './patternDetectionHandler'`
  - In `onComplete()`: after `saveSuggested()` + `analysisJob.update(COMPLETE)`, add isolated try/catch block calling `detectPatterns(teammateId, managerId)` (P-4.01, BR-4.05)
  - No other changes to existing handler

### API Route

- [x] Step 5: Create `pages/api/brief/[teammateId]/generate.ts`
  - Method: POST
  - `export const config = { api: { maxDuration: 30 } }`
  - `withAuth` HOC → managerId
  - Verify teammate ownership → 404 if not found (BR-4.17)
  - Call `generateBrief(managerId, teammateId)`
  - `EmptyHistoryError` → 422 `{ error: 'no_history' }` (BR-4.06)
  - Success → 200 `{ brief, fallback }` (always one is non-null)
  - Unexpected error → 500 via `sendError`

### Components

- [x] Step 6: Create `components/patterns/PatternList.tsx`
  - Props: `{ patterns: Pattern[], meetingCount: number }`
  - If `meetingCount < 2`: render no-history empty state (BR-4.01)
  - If `meetingCount >= 2` and `patterns.length === 0`: render no-patterns state
  - Otherwise: render sorted `PatternCard` list (ACTION_REQUIRED → WATCH → INFORMATIONAL)
  - `data-testid="pattern-list"`, `"pattern-empty-state"`, `"pattern-no-history"`

- [x] Step 7: Create `components/patterns/PatternCard.tsx`
  - Props: `{ pattern: PatternCardData }`
  - `expanded: boolean` state (default false)
  - Severity badge colors: INFORMATIONAL=blue, WATCH=amber, ACTION_REQUIRED=red
  - Expandable evidence section (meetingIds, dates, tags)
  - `data-testid="pattern-card-{id}"`, `"pattern-severity-{id}"`, `"pattern-description-{id}"`, `"pattern-expand-{id}"`

- [x] Step 8: Create `components/brief/BriefView.tsx`
  - Props: `{ brief: Brief, teammateName: string, onRegenerate: () => void, isRegenerating: boolean }`
  - Renders all 9 sections in order (see frontend-components.md)
  - "Copy to Clipboard" calls `formatBriefAsText(brief, teammateName)` → `navigator.clipboard.writeText()` → toast (US-11)
  - "Regenerate Brief" calls `onRegenerate()` (US-11)
  - `data-testid="brief-view"`, `"brief-context-summary"`, `"brief-coaching-focus"`, `"brief-uncomfortable-question"`, `"brief-regenerate-btn"`, `"brief-copy-btn"`

- [x] Step 9: Create `components/brief/BriefFallbackView.tsx`
  - Props: `{ fallback: BriefFallback, onRetry: () => void }`
  - Warning banner text (BR-4.09)
  - Open commitments list (if any)
  - Last meeting summary + date (if available)
  - "Try Again" button → `onRetry()`
  - `data-testid="brief-fallback-view"`, `"brief-fallback-retry"`

- [x] Step 10: Create `components/brief/CoachingApproachCard.tsx`
  - Props: `{ approach: CoachingApproach }`
  - Framework name badge, rationale, coaching actions list (US-12)
  - `data-testid="coaching-approach-card"`, `"coaching-framework-name"`, `"coaching-rationale"`

- [x] Step 11: Create `components/brief/QuestionList.tsx`
  - Props: `{ questions: string[] }`
  - Numbered list, one question per line
  - `data-testid="question-list"`, `"question-{index}"` (0-indexed)

- [x] Step 12: Create `components/brief/CommitmentListMini.tsx`
  - Props: `{ commitments: BriefCommitment[] }`
  - Empty: "No open commitments."
  - Owner badge + status chip (OPEN / CARRIED_FORWARD)
  - Highlight carryCount >= 2 (BR-4.11)
  - `data-testid="commitment-mini-list"`, `"commitment-mini-{index}"`

- [x] Step 13: Create `components/brief/PatternSignals.tsx`
  - Props: `{ patterns: BriefPattern[] }`
  - Empty: "No active pattern signals."
  - Severity badge + description for each (WATCH + ACTION_REQUIRED only — BR-4.10)
  - `data-testid="pattern-signals"`, `"pattern-signal-{index}"`

### Pages

- [x] Step 14: Create `pages/teammates/[id]/brief.tsx`
  - SSR `getServerSideProps`: withAuth → ownership check → return `{ teammateName, teammateId, managerEmail }` only
  - Client state: `brief`, `fallback`, `loading`, `noHistory`, `isRegenerating`, `toastMessage`
  - `useEffect` on mount: calls `POST /api/brief/[teammateId]/generate` (P-4.06)
  - 422 → `setNoHistory(true)`
  - 200 + brief → `setBrief(data.brief)`
  - 200 + fallback → `setFallback(data.fallback)`
  - `handleRegenerate()`: resets brief/fallback, sets isRegenerating, re-calls generate
  - Toast auto-clears after 3s
  - Renders: loading spinner | noHistory state | `<BriefView>` | `<BriefFallbackView>`
  - `data-testid="brief-page"`, `"brief-loading"`, `"brief-no-history"`

- [x] Step 15: Modify `pages/teammates/[id]/index.tsx`
  - In `getServerSideProps`: add parallel `prisma.pattern.findMany(...)` + `prisma.meeting.count(...)` reads (LC-4.05)
  - Add `patterns: Pattern[]` and `meetingCount: number` to page props
  - Add `import PatternList from '@/components/patterns/PatternList'`
  - Render `<PatternList patterns={patterns} meetingCount={meetingCount} />` below existing content
  - Add "Prepare for 1:1" button linking to `/teammates/${id}/brief` with `data-testid="prepare-brief-btn"`

### Tests

- [x] Step 16: Create `handlers/patternDetectionHandler.test.ts`
  - `buildPatternPrompt()`: includes summaries, tag frequencies, teammate name
  - `parsePatternResponse()`: valid JSON array → DetectedPattern[]; invalid severity dropped; malformed → PatternParseError
  - `detectPatterns()`: < 2 meetings → returns early (no Claude call); ≥ 2 meetings → calls Claude; failure isolated
  - `upsertPattern()`: dedup logic (same severity + ≥2 tag overlap → update); count ≥ 10 → evict oldest INFORMATIONAL

- [x] Step 17: Create `handlers/coachingStrategyHandler.test.ts`
  - `parseFrameworkResponse()`: valid framework returned; unknown framework → null (triggers fallback)
  - `fallbackApproach()`: returns object with expected fallback text
  - `selectFramework()`: success → returns CoachingApproach; Claude error → returns fallbackApproach()

- [x] Step 18: Create `handlers/briefGenerationHandler.test.ts`
  - `parseBriefResponse()`: all fields present → Brief; missing required field → BriefParseError
  - `buildFallback()`: returns commitments + last meeting summary
  - `formatBriefAsText()`: produces non-empty string with section headers; includes coaching approach and questions
  - `generateBrief()`: 0 meetings → throws EmptyHistoryError; Claude success → `{ brief, fallback: null }`; Claude failure → `{ brief: null, fallback }`

- [x] Step 19: Create `pages/api/brief/[teammateId]/generate.test.ts`
  - No auth → 401
  - Auth + teammate not owned by manager → 404
  - Auth + owned + 0 meetings → 422 `{ error: 'no_history' }`
  - Auth + owned + meetings + Claude success → 200 `{ brief: {...}, fallback: null }`
  - Auth + owned + meetings + Claude failure → 200 `{ brief: null, fallback: {...} }`

### Documentation

- [x] Step 20: Create `aidlc-docs/construction/unit-4-intelligence-engine/code/code-summary.md`
  - List all created/modified files with paths
  - Story coverage summary (US-09, US-10, US-11, US-12)
  - Key patterns applied
  - Test coverage summary

---

## Story Traceability

| Story | Steps Implementing |
|-------|--------------------|
| US-09 — View detected patterns | Steps 1, 4, 6, 7, 15, 16 |
| US-10 — Generate pre-meeting brief | Steps 2, 3, 5, 8, 9, 11, 12, 13, 14, 17, 18, 19 |
| US-11 — Regenerate/copy brief | Steps 3, 8, 14, 18 |
| US-12 — Coaching framework in brief | Steps 2, 8, 10, 14, 17 |
