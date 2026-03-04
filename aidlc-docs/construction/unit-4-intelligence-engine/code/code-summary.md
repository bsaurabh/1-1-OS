# Unit 4: Intelligence Engine — Code Summary

**Unit**: Unit 4: Intelligence Engine
**Stories**: US-09, US-10, US-11, US-12
**Date**: 2026-03-02
**Status**: Complete

---

## Files Created / Modified

### Handlers (Business Logic)

| # | Path | Action | Stories |
|---|------|--------|---------|
| 1 | `handlers/patternDetectionHandler.ts` | Created | US-09 |
| 2 | `handlers/coachingStrategyHandler.ts` | Created | US-12 |
| 3 | `handlers/briefGenerationHandler.ts` | Created | US-10, US-11 |
| 4 | `handlers/meetingAnalysisHandler.ts` | Modified | US-09 |

### API Route

| # | Path | Action | Stories |
|---|------|--------|---------|
| 5 | `pages/api/brief/[teammateId]/generate.ts` | Created | US-10, US-11, US-12 |

### Components

| # | Path | Action | Stories |
|---|------|--------|---------|
| 6 | `components/patterns/PatternList.tsx` | Created | US-09 |
| 7 | `components/patterns/PatternCard.tsx` | Created | US-09 |
| 8 | `components/brief/BriefView.tsx` | Created | US-10, US-11 |
| 9 | `components/brief/BriefFallbackView.tsx` | Created | US-10 |
| 10 | `components/brief/CoachingApproachCard.tsx` | Created | US-12 |
| 11 | `components/brief/QuestionList.tsx` | Created | US-10 |
| 12 | `components/brief/CommitmentListMini.tsx` | Created | US-10 |
| 13 | `components/brief/PatternSignals.tsx` | Created | US-10 |

### Pages

| # | Path | Action | Stories |
|---|------|--------|---------|
| 14 | `pages/teammates/[id]/brief.tsx` | Created | US-10, US-11, US-12 |
| 15 | `pages/teammates/[id]/index.tsx` | Modified | US-09 |

### Tests

| # | Path | Action |
|---|------|--------|
| 16 | `handlers/patternDetectionHandler.test.ts` | Created |
| 17 | `handlers/coachingStrategyHandler.test.ts` | Created |
| 18 | `handlers/briefGenerationHandler.test.ts` | Created |
| 19 | `pages/api/brief/[teammateId]/generate.test.ts` | Created |

**Total**: 19 application files (15 new, 2 modified) + 4 test files

---

## Story Coverage

| Story | Implementation |
|-------|---------------|
| US-09 — View detected patterns | `patternDetectionHandler.ts` (detection), `meetingAnalysisHandler.ts` (chain), `PatternList.tsx` + `PatternCard.tsx` (display), `index.tsx` (SSR reads + render) |
| US-10 — Generate pre-meeting brief | `briefGenerationHandler.ts` (generation), `generate.ts` (API route), `BriefView.tsx`, `BriefFallbackView.tsx`, `QuestionList.tsx`, `CommitmentListMini.tsx`, `PatternSignals.tsx`, `brief.tsx` (page) |
| US-11 — Regenerate/copy brief | `briefGenerationHandler.ts` (`formatBriefAsText()`), `BriefView.tsx` (copy + regenerate buttons), `brief.tsx` (handleRegenerate) |
| US-12 — Coaching framework in brief | `coachingStrategyHandler.ts` (selection), `briefGenerationHandler.ts` (integration), `CoachingApproachCard.tsx` (display), `BriefView.tsx` (section) |

---

## Key Patterns Applied

| Pattern | Where Applied |
|---------|--------------|
| P-4.01 Chained Side-Effect Isolation | `meetingAnalysisHandler.ts` — `detectPatterns()` wrapped in isolated try/catch in `onComplete()` |
| P-4.02 Parallel DB Pre-fetch | `briefGenerationHandler.ts` — `Promise.all([teammate, meetings, commitments, patterns])` |
| P-4.02 (page-level) | `index.tsx` — `Promise.all([getTeammate, manager, patterns, meetingCount])` |
| P-4.03 Graceful Degradation | `briefGenerationHandler.ts` — catch block returns `buildFallback()` instead of throwing |
| P-4.04 Tiered Model Selection | Haiku (`claude-haiku-4-5-20251001`) for pattern detection + framework selection; Sonnet (`claude-sonnet-4-6`) for brief synthesis |
| P-4.05 Bounded Collection Eviction | `patternDetectionHandler.ts` — `upsertPattern()` evicts INFORMATIONAL→WATCH before inserting when count ≥ 10 |
| P-4.06 Client-Side Async Shell | `brief.tsx` — SSR renders shell only; `useEffect` fires POST to generate on mount |
| P-4.07 Pure Text Serializer | `briefGenerationHandler.ts` — `formatBriefAsText()` is a pure function with no side effects |

---

## Business Rules Implemented

| Rule | Implementation |
|------|---------------|
| BR-4.01 — Require ≥2 meetings for patterns | `detectPatterns()` early return if `meetings.length < 2` |
| BR-4.04 — Dedup patterns by severity + tag overlap | `upsertPattern()` checks existing patterns for same severity + ≥2 shared tags |
| BR-4.05 — Pattern failure must not affect ANALYSIS_COMPLETE | `onComplete()` try/catch isolation |
| BR-4.06 — EmptyHistoryError on 0 meetings | `generateBrief()` throws `EmptyHistoryError`; route returns 422 |
| BR-4.08 — Validate required brief fields | `parseBriefResponse()` throws `BriefParseError` for missing contextSummary, coachingFocus, followUpQuestions, uncomfortableQuestion |
| BR-4.09 — Always return data or fallback | `generateBrief()` catch block returns `buildFallback()` |
| BR-4.10 — Only WATCH + ACTION_REQUIRED in brief patterns | Filter in `generateBrief()` and `PatternSignals.tsx` |
| BR-4.11 — Highlight commitments carried ≥2 times | `CommitmentListMini.tsx` adds carry badge when `carryCount >= 2` |
| BR-4.14 — Fallback coaching approach | `fallbackApproach()` returns General framework with open-ended guidance |
| BR-4.17 — Verify teammate ownership before generation | `generate.ts` calls `prisma.teammate.findFirst({ where: { id, managerId } })` before generating |
| BR-4.20 — Cap patterns at 10 per teammate | `upsertPattern()` evicts when `count >= MAX_PATTERNS_PER_TEAMMATE` |

---

## Test Coverage Summary

### `patternDetectionHandler.test.ts`
- `buildPatternPrompt()`: teammate name, summaries, tag frequencies, severity guide, JSON-only requirement
- `parsePatternResponse()`: valid JSON, empty array, invalid severity filtered, missing description/evidence filtered, regex fallback, `PatternParseError` for bad input
- `detectPatterns()`: early return < 2 meetings, Claude called with ≥ 2 meetings, empty response handled
- `upsertPattern()` (via detectPatterns): dedup on same severity + ≥2 tag overlap, eviction at MAX capacity

### `coachingStrategyHandler.test.ts`
- `parseFrameworkResponse()`: all valid frameworks, unknown framework → null, missing rationale → null, regex fallback, unparseable → null
- `fallbackApproach()`: returns object with General framework + rationale + actions
- `buildFrameworkSelectionPrompt()`: teammate name, all frameworks, pattern details, carry count
- `selectFramework()`: success returns parsed approach, invalid framework → fallback, Claude error → fallback, unparseable → fallback

### `briefGenerationHandler.test.ts`
- `parseBriefResponse()`: all required fields, regex fallback, `BriefParseError` for each missing required field, empty riskSignals accepted
- `buildFallback()`: commitment mapping, last meeting fields, null when no meeting
- `formatBriefAsText()`: non-empty output, teammate name, all section headers, questions numbered, risk signals conditional
- `generateBrief()`: `EmptyHistoryError` on 0 meetings, success returns `{ brief, fallback: null }`, Claude error returns `{ brief: null, fallback }`, INFORMATIONAL patterns excluded (BR-4.10)

### `generate.test.ts`
- 405 for non-POST
- 404 when teammate not owned by manager
- 422 + `{ error: 'no_history' }` when `EmptyHistoryError`
- 200 + `{ brief, fallback: null }` on success
- 200 + `{ brief: null, fallback }` on Claude failure
- 500 on unexpected error
- Correct arguments passed to `generateBrief`
