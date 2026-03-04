# Unit 5: Tracker & Timeline — Code Generation Plan

**Unit**: Unit 5: Tracker & Timeline
**Stories**: US-13 (Timeline with tag filter), US-14 (Manual commitment creation), US-15 (Review/resolve commitments)
**Date**: 2026-03-02
**Workspace root**: `/Users/saurabhbajaj/Desktop/testproject`

---

## Unit Context

| Item | Detail |
|------|--------|
| Stories | US-13, US-14, US-15 |
| Depends on | Unit 1 (Prisma schema, withAuth, AppLayout, apiError), Unit 2 (@anthropic-ai/sdk, Anthropic client), Unit 3 (lib/commitments.ts — saveSuggested/confirm/dismiss already exist), Unit 4 (callClaudeWithRetry pattern inlined in handlers) |
| New runtime dependencies | None |
| New env variables | None |
| DB migration | None (full schema defined Unit 1) |
| Claude models | `claude-haiku-4-5-20251001` (growth summary only) |
| Key patterns | P-5.01 Parallel DB Pre-fetch, P-5.02 Graceful Degradation, P-5.03 Read-Time Derived Signal, P-5.04 Extended Action Dispatch, P-5.05 Client-Side Collection Filter |

---

## Files to Create / Modify

| # | Path | Action | Stories |
|---|------|--------|---------|
| 1 | `lib/commitments.ts` | **Modify** — add createCommitment, updateStatus, listOpen, listResolved, deleteCommitment | US-14, US-15 |
| 2 | `pages/api/commitments/[teammateId].ts` | **Modify** — update GET (?status=open/resolved), add POST | US-14, US-15 |
| 3 | `pages/api/commitments/[id].ts` | **Modify** — extend PATCH (done/carried_forward/dropped), add DELETE | US-15 |
| 4 | `lib/timeline.ts` | **Create** — listTimeline, generateGrowthSummary, buildGrowthSummaryPrompt, parseGrowthSummaryResponse, EmptyHistoryError | US-13 |
| 5 | `pages/api/timeline/[teammateId].ts` | **Create** — GET timeline | US-13 |
| 6 | `pages/api/timeline/[teammateId]/summary.ts` | **Create** — POST growth summary | US-13 |
| 7 | `components/commitments/CommitmentCard.tsx` | **Create** — card with status actions | US-14, US-15 |
| 8 | `components/commitments/CommitmentList.tsx` | **Create** — list of CommitmentCards | US-14, US-15 |
| 9 | `components/commitments/AddCommitmentModal.tsx` | **Create** — modal with duplicate detection | US-14 |
| 10 | `components/commitments/BrokenPatternSignals.tsx` | **Create** — read-time derived pattern signal (P-5.03) | US-15 |
| 11 | `components/timeline/TimelineList.tsx` | **Create** — timeline list with empty states | US-13 |
| 12 | `components/timeline/TimelineEntry.tsx` | **Create** — single meeting entry | US-13 |
| 13 | `components/timeline/TagFilter.tsx` | **Create** — tag chip filter | US-13 |
| 14 | `components/timeline/GrowthSummaryPanel.tsx` | **Create** — on-demand summary panel | US-13 |
| 15 | `pages/teammates/[id]/commitments.tsx` | **Create** — commitments tracker page | US-14, US-15 |
| 16 | `pages/teammates/[id]/timeline.tsx` | **Create** — growth timeline page | US-13 |
| 17 | `pages/teammates/[id]/index.tsx` | **Modify** — add tab navigation (Profile/Timeline/Commitments/Brief) | US-13, US-14 |
| 18 | `lib/commitments.test.ts` | **Modify** — add tests for 5 new functions | US-14, US-15 |
| 19 | `pages/api/commitments/[teammateId].test.ts` | **Create** — tests for GET (open/resolved) + POST | US-14, US-15 |
| 20 | `pages/api/commitments/[id].test.ts` | **Modify** — add tests for new actions + DELETE | US-15 |
| 21 | `lib/timeline.test.ts` | **Create** — tests for listTimeline + generateGrowthSummary | US-13 |
| 22 | `pages/api/timeline/[teammateId].test.ts` | **Create** — tests for GET timeline route | US-13 |
| 23 | `pages/api/timeline/[teammateId]/summary.test.ts` | **Create** — tests for POST summary route | US-13 |
| 24 | `aidlc-docs/construction/unit-5-tracker-and-timeline/code/code-summary.md` | **Create** — code summary doc | — |

---

## Detailed Steps

### Step 1 — Modify `lib/commitments.ts`
Add 5 new exported functions after existing exports:
- `createCommitment(managerId, teammateId, text, owner, dueDate?)` — duplicate check (case-insensitive text match on OPEN+CARRIED_FORWARD) → create OPEN; returns `{commitment}` or `{duplicate: true, existingId}`
- `updateStatus(managerId, id, action: 'done'|'carried_forward'|'dropped')` — find by id+managerId+status IN [OPEN,CARRIED_FORWARD]; update status; if carried_forward: increment carryCount; returns Commitment|null
- `listOpen(managerId, teammateId)` — findMany where status IN [OPEN, CARRIED_FORWARD], orderBy createdAt asc
- `listResolved(managerId, teammateId)` — findMany where status IN [DONE, DROPPED], orderBy updatedAt desc, take 20
- `deleteCommitment(managerId, id)` — findFirst by id+managerId, delete, return boolean

### Step 2 — Modify `pages/api/commitments/[teammateId].ts`
Replace current handler:
- GET with `?status=open` → `listOpen()`; `?status=resolved` → `listResolved()`; missing/invalid → 400
- POST body `{text, owner, dueDate?}` → validate text+owner → `createCommitment()` → 201 or 409
- Both methods: verify teammate ownership first → 404 if not found
- 405 for other methods

### Step 3 — Modify `pages/api/commitments/[id].ts`
Extend PATCH dispatch + add DELETE:
- PATCH: keep existing `confirm` / `dismiss` dispatch; add `done` / `carried_forward` / `dropped` → `updateStatus()`; update 400 error message to list all 5 valid actions
- DELETE: `deleteCommitment(managerId, id)` → 200 `{success:true}` or 404
- Method guard: allow PATCH and DELETE; 405 for others

### Step 4 — Create `lib/timeline.ts`
New lib file:
- `listTimeline(managerId, teammateId)` — `prisma.meeting.findMany` (all statuses, ordered createdAt desc); return `TimelineMeetingEntry[]`
- `generateGrowthSummary(managerId, teammateId, client?)` — `Promise.all([teammate, meetings])` (P-5.01); throw `EmptyHistoryError` if no ANALYSIS_COMPLETE meetings; build prompt; `callClaudeWithRetry`; parse response; catch → return null (P-5.02)
- `buildGrowthSummaryPrompt(teammate, meetings)` — returns prompt string
- `parseGrowthSummaryResponse(text)` — JSON parse; return `Partial<GrowthSummary>`
- Export `EmptyHistoryError extends Error`, `SUMMARY_MODEL = 'claude-haiku-4-5-20251001'`, `MAX_MEETINGS_FOR_SUMMARY = 10`
- `callClaudeWithRetry` inlined (same pattern as other handlers: 1 retry, 1s delay)

### Step 5 — Create `pages/api/timeline/[teammateId].ts`
GET route:
- `withAuth` → verify teammate ownership → 404; `listTimeline()` → 200 `{meetings}`
- 405 for non-GET

### Step 6 — Create `pages/api/timeline/[teammateId]/summary.ts`
POST route:
- `withAuth` → verify teammate ownership → 404
- `generateGrowthSummary()` → EmptyHistoryError → 422; null → 200 `{summary:null}`; GrowthSummary → 200 `{summary}`
- DB errors → 500; 405 for non-POST

### Step 7 — Create `components/commitments/CommitmentCard.tsx`
Props: `{commitment, onAction, showActions?}`
- Owner badge, status chip, text, due date
- carryCount >= 2: "Carried Nx" amber badge
- CARRIED_FORWARD + carryCount >= 2: amber left border
- OPEN/CARRIED_FORWARD with showActions: [Mark Done] [Carry Forward] [Drop] buttons
- All data-testids from frontend-components.md

### Step 8 — Create `components/commitments/CommitmentList.tsx`
Props: `{commitments, onAction, showActions?, emptyMessage?}`
- Empty state with `data-testid="commitment-list-empty"`
- Map → `<CommitmentCard>` with `data-testid="commitment-list"`

### Step 9 — Create `components/commitments/AddCommitmentModal.tsx`
Modal with text area, owner toggle (MANAGER/TEAMMATE), optional due date, duplicate warning.
POST `/api/commitments/[teammateId]` → 201 or 409 handling.
All data-testids from frontend-components.md.

### Step 10 — Create `components/commitments/BrokenPatternSignals.tsx`
P-5.03: Filter `commitments.filter(c => c.carryCount >= 2)`, render amber warning cards.
`data-testid="broken-pattern-signals"` and `broken-pattern-signal-{index}` per card.

### Step 11 — Create `components/timeline/TimelineList.tsx`
Props: `{meetings, activeTag}`
- Empty: "No meetings recorded yet…" with `data-testid="timeline-empty"`
- Filtered empty: "No meetings tagged '{tag}'." with `data-testid="timeline-filtered-empty"`
- Map → `<TimelineEntry>` with `data-testid="timeline-list"`

### Step 12 — Create `components/timeline/TimelineEntry.tsx`
Props: `{meeting: TimelineMeetingEntry}`
- Date, source icon, summary text (or "Analysis in progress…" / "Analysis failed."), tag chips
- data-testids: `timeline-entry-{id}`, `timeline-entry-date-{id}`, `timeline-entry-summary-{id}`, `timeline-entry-tags-{id}`

### Step 13 — Create `components/timeline/TagFilter.tsx`
Props: `{availableTags, activeTag, onTagSelect}`
- "All" chip (`data-testid="tag-filter-all"`) + one chip per tag
- `data-testid="tag-filter"`, `tag-filter-chip-{tag}`

### Step 14 — Create `components/timeline/GrowthSummaryPanel.tsx`
Props: `{summary, isLoading, onGenerate}`
- Not generated: "Generate Growth Summary" button
- Loading: spinner + "Generating summary…"
- Null after attempt: "Growth summary unavailable. Try again later." + retry
- Loaded: narrative, keyThemes, growthSignals, coachingGaps
- data-testids: `growth-summary-panel`, `generate-summary-btn`, `summary-narrative`, `summary-themes`

### Step 15 — Create `pages/teammates/[id]/commitments.tsx`
SSR shell: `withAuth` → teammate ownership check → `{teammateName, teammateId, managerEmail}`.
Client: `useEffect` → parallel fetch open + resolved; `handleAction(id, action)` → PATCH; add modal toggle; BrokenPatternSignals below active list.
data-testids: `commitments-page`, `add-commitment-btn`, `show-resolved-btn`

### Step 16 — Create `pages/teammates/[id]/timeline.tsx`
SSR shell: `withAuth` → teammate ownership check → `{teammateName, teammateId, managerEmail}`.
Client: `useEffect` → GET timeline; `useMemo` for `filteredMeetings` + `availableTags` (P-5.05); `handleGenerateSummary` → POST summary.
data-testids: `timeline-page`, `generate-summary-btn`, `summary-panel`, `timeline-list`, `timeline-empty`

### Step 17 — Modify `pages/teammates/[id]/index.tsx`
Add `TeammateTabNav` inline (4 tabs: Profile*/Timeline/Commitments/Brief) below the back-button row.
Remove the "Prepare for 1:1" header button (replaced by Brief tab).
data-testids: `teammate-tabs`, `tab-profile`, `tab-timeline`, `tab-commitments`, `tab-brief`

### Step 18 — Modify `lib/commitments.test.ts`
Append test blocks for: `createCommitment` (success, duplicate detected), `updateStatus` (done, carried_forward increments carryCount, dropped, not found → null), `listOpen` (OPEN+CARRIED_FORWARD filter), `listResolved` (DONE+DROPPED, take 20), `deleteCommitment` (success, not found)

### Step 19 — Create `pages/api/commitments/[teammateId].test.ts`
Tests for updated route:
- 405 for non-GET/POST; GET 400 missing status; GET 200 open; GET 200 resolved; GET 404 no teammate
- POST 400 missing text; POST 201 created; POST 409 duplicate; POST 404 no teammate

### Step 20 — Modify `pages/api/commitments/[id].test.ts`
Append test blocks:
- PATCH action=done → 200; PATCH action=carried_forward → 200; PATCH action=dropped → 200; PATCH new action → 404 (not found); 400 updated message lists all 5 actions
- DELETE 200 success; DELETE 404 not found

### Step 21 — Create `lib/timeline.test.ts`
Tests for: `listTimeline` (returns meeting array, scoped to manager+teammate); `generateGrowthSummary` (EmptyHistoryError if 0 ANALYSIS_COMPLETE meetings; Promise.all pre-fetch called; Claude success → GrowthSummary; Claude error → null P-5.02); `parseGrowthSummaryResponse` (valid JSON, missing fields); `buildGrowthSummaryPrompt` (includes teammate name)

### Step 22 — Create `pages/api/timeline/[teammateId].test.ts`
Tests for: 405 non-GET; 404 no teammate; 200 with meetings array

### Step 23 — Create `pages/api/timeline/[teammateId]/summary.test.ts`
Tests for: 405 non-POST; 404 no teammate; 422 EmptyHistoryError; 200 with GrowthSummary; 200 with null (Claude failure); 500 DB error

### Step 24 — Create `aidlc-docs/construction/unit-5-tracker-and-timeline/code/code-summary.md`
Summary of all files created/modified, story coverage (US-13, US-14, US-15), patterns applied, test coverage.

---

## Step Progress Tracking

- [x] Step 1: Modify lib/commitments.ts
- [x] Step 2: Modify pages/api/commitments/[teammateId].ts
- [x] Step 3: Modify pages/api/commitments/[id].ts
- [x] Step 4: Create lib/timeline.ts
- [x] Step 5: Create pages/api/timeline/[teammateId].ts
- [x] Step 6: Create pages/api/timeline/[teammateId]/summary.ts
- [x] Step 7: Create components/commitments/CommitmentCard.tsx
- [x] Step 8: Create components/commitments/CommitmentList.tsx
- [x] Step 9: Create components/commitments/AddCommitmentModal.tsx
- [x] Step 10: Create components/commitments/BrokenPatternSignals.tsx
- [x] Step 11: Create components/timeline/TimelineList.tsx
- [x] Step 12: Create components/timeline/TimelineEntry.tsx
- [x] Step 13: Create components/timeline/TagFilter.tsx
- [x] Step 14: Create components/timeline/GrowthSummaryPanel.tsx
- [x] Step 15: Create pages/teammates/[id]/commitments.tsx
- [x] Step 16: Create pages/teammates/[id]/timeline.tsx
- [x] Step 17: Modify pages/teammates/[id]/index.tsx
- [x] Step 18: Modify lib/commitments.test.ts
- [x] Step 19: Create pages/api/commitments/[teammateId].test.ts
- [x] Step 20: Modify pages/api/commitments/[id].test.ts
- [x] Step 21: Create lib/timeline.test.ts
- [x] Step 22: Create pages/api/timeline/[teammateId].test.ts
- [x] Step 23: Create pages/api/timeline/[teammateId]/summary.test.ts
- [x] Step 24: Create aidlc-docs/construction/unit-5-tracker-and-timeline/code/code-summary.md
