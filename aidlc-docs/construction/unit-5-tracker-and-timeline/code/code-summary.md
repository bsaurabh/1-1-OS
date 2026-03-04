# Code Summary — Unit 5: Tracker & Timeline

**Date**: 2026-03-03
**Unit**: Unit 5: Tracker & Timeline
**Stories**: US-13, US-14, US-15

---

## Application Files

### Modified Files

| File | Change |
|------|--------|
| `lib/commitments.ts` | Added: `createCommitment`, `updateStatus`, `listOpen`, `listResolved`, `deleteCommitment` |
| `pages/api/commitments/[teammateId].ts` | Updated GET (?status=open/resolved), added POST (create commitment) |
| `pages/api/commitments/[id].ts` | Extended PATCH (done/carried_forward/dropped via P-5.04), added DELETE |
| `pages/teammates/[id]/index.tsx` | Added tab navigation (Profile/Timeline/Commitments/Brief), removed "Prepare for 1:1" header button |

### Created Files

| File | Purpose |
|------|---------|
| `lib/timeline.ts` | `listTimeline`, `generateGrowthSummary` (P-5.01, P-5.02), `buildGrowthSummaryPrompt`, `parseGrowthSummaryResponse`, `EmptyHistoryError` |
| `pages/api/timeline/[teammateId].ts` | GET — returns all meetings for timeline (tag filter done client-side, P-5.05) |
| `pages/api/timeline/[teammateId]/summary.ts` | POST — growth summary generation; always 200 (P-5.02) |
| `components/commitments/CommitmentCard.tsx` | Commitment card with OPEN/CARRIED_FORWARD actions, carryCount badge, amber border signal |
| `components/commitments/CommitmentList.tsx` | List of CommitmentCards with empty state |
| `components/commitments/AddCommitmentModal.tsx` | Modal with text/owner/dueDate; 409 duplicate detection flow |
| `components/commitments/BrokenPatternSignals.tsx` | Read-time derived pattern signal — `carryCount >= 2` (P-5.03) |
| `components/timeline/TimelineList.tsx` | Timeline list with per-tag and global empty states |
| `components/timeline/TimelineEntry.tsx` | Single meeting entry: date, summary, tone, tag chips |
| `components/timeline/TagFilter.tsx` | "All" + tag chips; clicking active tag deselects (P-5.05) |
| `components/timeline/GrowthSummaryPanel.tsx` | 4-state panel: not-generated / loading / error / loaded |
| `pages/teammates/[id]/commitments.tsx` | Commitments tracker page (SSR shell + client fetch) |
| `pages/teammates/[id]/timeline.tsx` | Growth timeline page (SSR shell + `useMemo` filter, P-5.05) |

---

## Test Files

### Modified Test Files

| File | Tests Added |
|------|-------------|
| `lib/commitments.test.ts` | +10 tests: `createCommitment` (success, duplicate), `updateStatus` (done/carried_forward/dropped/notFound), `listOpen`, `listResolved`, `deleteCommitment` (success/notFound) |
| `pages/api/commitments/[id].test.ts` | +7 tests: new 400 message check, done/carried_forward/dropped 200, updateStatus 404, DELETE 200/404 |

### Created Test Files

| File | Tests |
|------|-------|
| `pages/api/commitments/[teammateId].test.ts` | GET: 405/404/400/200-open/200-resolved; POST: 400 missing text/400 invalid owner/201 created/409 duplicate |
| `lib/timeline.test.ts` | `listTimeline` (returns entries, empty), `buildGrowthSummaryPrompt` (name/summary in prompt), `parseGrowthSummaryResponse` (valid/invalid/embedded JSON), `generateGrowthSummary` (EmptyHistoryError, success, null on Claude failure, parallel pre-fetch) |
| `pages/api/timeline/[teammateId].test.ts` | 405/404/200 |
| `pages/api/timeline/[teammateId]/summary.test.ts` | 405/404/422 EmptyHistoryError/200 success/200 null (P-5.02)/500 DB error/correct args |

---

## Story Coverage

| Story | Implemented by |
|-------|---------------|
| US-13 — Growth timeline with tag filter | `lib/timeline.ts`, `pages/api/timeline/[teammateId].ts`, `pages/api/timeline/[teammateId]/summary.ts`, `components/timeline/*`, `pages/teammates/[id]/timeline.tsx` |
| US-14 — Manual commitment creation | `lib/commitments.ts` (createCommitment), `pages/api/commitments/[teammateId].ts` (POST), `components/commitments/AddCommitmentModal.tsx`, `pages/teammates/[id]/commitments.tsx` |
| US-15 — Review and resolve commitments | `lib/commitments.ts` (updateStatus/listOpen/listResolved/deleteCommitment), `pages/api/commitments/[id].ts` (PATCH done/carry/drop + DELETE), `components/commitments/CommitmentCard.tsx`, `components/commitments/BrokenPatternSignals.tsx`, `pages/teammates/[id]/commitments.tsx` |

---

## NFR Patterns Applied

| Pattern | Applied In |
|---------|-----------|
| P-5.01 Parallel DB Pre-fetch | `lib/timeline.ts` — `Promise.all([teammate, meetings])` before Haiku call |
| P-5.02 Graceful Degradation | `lib/timeline.ts` — Claude failure returns `null`; route always emits 200 |
| P-5.03 Read-Time Derived Signal | `components/commitments/BrokenPatternSignals.tsx` — filters `carryCount >= 2` at render; no DB write |
| P-5.04 Extended Action Dispatch | `pages/api/commitments/[id].ts` — single PATCH route handles confirm/dismiss/done/carried_forward/dropped |
| P-5.05 Client-Side Collection Filter | `pages/teammates/[id]/timeline.tsx` — `useMemo` for `filteredMeetings` + `availableTags`; single API call |

---

## Business Rules Implemented

- BR-5.01–BR-5.05: Manual commitment creation (OPEN status, duplicate detection 409, owner validation)
- BR-5.06–BR-5.09: Status transition matrix (done/carried_forward/dropped from OPEN or CARRIED_FORWARD only)
- BR-5.10–BR-5.12: carryCount increment on carried_forward; broken pattern signal at carryCount ≥ 2
- BR-5.13–BR-5.15: Resolved list capped at 20, ordered by updatedAt desc
- BR-5.16–BR-5.18: Timeline returns all meetings (all statuses); tag filter client-side
- BR-5.19–BR-5.21: Growth summary guards (EmptyHistoryError on 0 ANALYSIS_COMPLETE meetings; null on Claude failure; not persisted)

---

## Total: 4 modified + 13 created = 17 application files; 2 modified + 4 created = 6 test files
