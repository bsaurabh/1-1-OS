# Logical Components — Unit 5: Tracker & Timeline

**Date**: 2026-03-02
**Unit**: Unit 5: Tracker & Timeline

---

## New Logical Components

---

### LC-5.01 — lib/commitments.ts (Extended)

**File**: `lib/commitments.ts`
**Deployed as**: Module within commitment API route serverless functions
**Patterns applied**: P-5.04 (extended action dispatch — updateStatus handles all lifecycle transitions)

**New/Extended Interface**:
```typescript
// New in Unit 5
export async function createCommitment(
  managerId: string,
  teammateId: string,
  text: string,
  owner: 'MANAGER' | 'TEAMMATE',
  dueDate?: string | null
): Promise<{ commitment: Commitment } | { duplicate: true; existingId: string }>

export async function updateStatus(
  managerId: string,
  id: string,
  action: 'done' | 'carried_forward' | 'dropped'
): Promise<Commitment | null>

export async function listOpen(
  managerId: string,
  teammateId: string
): Promise<Commitment[]>

export async function listResolved(
  managerId: string,
  teammateId: string
): Promise<Commitment[]>    // capped at 20, ordered by updatedAt DESC

export async function deleteCommitment(
  managerId: string,
  id: string
): Promise<boolean>

// Existing (Unit 3) — confirm + dismiss remain unchanged
```

**Status transition matrix** (enforced in `updateStatus`):
| Action | Allowed from | Result |
|--------|-------------|--------|
| `done` | OPEN, CARRIED_FORWARD | DONE |
| `carried_forward` | OPEN, CARRIED_FORWARD | CARRIED_FORWARD + carryCount++ |
| `dropped` | OPEN, CARRIED_FORWARD | DROPPED |

**Dependencies**: `@prisma/client` (via `lib/prisma`)
**Called by**: `/api/commitments/[id]` (PATCH, DELETE), `/api/commitments/[teammateId]` (POST, GET)

---

### LC-5.02 — lib/timeline.ts (New)

**File**: `lib/timeline.ts`
**Deployed as**: Module within timeline API route serverless functions
**Patterns applied**: P-5.01 (parallel DB pre-fetch), P-5.02 (graceful degradation)

**Interface**:
```typescript
export async function listTimeline(
  managerId: string,
  teammateId: string
): Promise<TimelineMeetingEntry[]>

export async function generateGrowthSummary(
  managerId: string,
  teammateId: string,
  client?: Anthropic    // injectable for tests
): Promise<GrowthSummary | null>

export function buildGrowthSummaryPrompt(
  teammate: { name: string; profile: unknown },
  meetings: MeetingRecord[]
): string

export function parseGrowthSummaryResponse(text: string): Partial<GrowthSummary>

export class EmptyHistoryError extends Error {}

// Constants
export const SUMMARY_MODEL = 'claude-haiku-4-5-20251001'
export const MAX_MEETINGS_FOR_SUMMARY = 10

// Type exports
export interface TimelineMeetingEntry {
  id: string
  summary: string | null
  tags: string[]
  tone: string | null
  status: string
  createdAt: string
}

export interface GrowthSummary {
  teammateName: string
  generatedAt: string
  narrative: string
  keyThemes: string[]
  growthSignals: string[]
  coachingGaps: string[]
}
```

**P-5.01 — Parallel pre-fetch** (inside `generateGrowthSummary`):
```typescript
const [teammate, meetings] = await Promise.all([
  prisma.teammate.findFirst({ where: { id: teammateId, managerId }, select: { name, profile } }),
  prisma.meeting.findMany({ where: { managerId, teammateId, status: 'ANALYSIS_COMPLETE' }, ... }),
])
```

**P-5.02 — Graceful degradation**: Claude failure returns `null`; caller wraps as `{ summary: null }` → always 200.

**Dependencies**: `@anthropic-ai/sdk`, `@prisma/client` (via `lib/prisma`), `lib/claude` (callClaudeWithRetry)
**Called by**: `/api/timeline/[teammateId]` (GET), `/api/timeline/[teammateId]/summary` (POST)

---

## New API Route Components

---

### LC-5.03 — `GET /api/commitments/[teammateId]`

**File**: `pages/api/commitments/[teammateId].ts`
**Method**: GET
**Auth**: `withAuth`
**Query param**: `status=open` | `status=resolved`

**Response**:
```typescript
// 200 — status=open (OPEN + CARRIED_FORWARD)
{ commitments: Commitment[] }

// 200 — status=resolved (DONE + DROPPED, last 20)
{ commitments: Commitment[] }

// 400 — missing or invalid status param
{ error: 'status must be open or resolved' }

// 404 — teammate not found / not owned by manager
{ error: 'Teammate not found' }
```

**Logic**:
```
withAuth → managerId
│
├─ Verify teammate ownership
│    └─ if not found → 404
│
├─ status=open  → listOpen(managerId, teammateId)  → 200
├─ status=resolved → listResolved(managerId, teammateId) → 200
└─ else → 400
```

---

### LC-5.04 — `POST /api/commitments/[teammateId]`

**File**: `pages/api/commitments/[teammateId].ts` (same file as GET, dispatch on method)
**Method**: POST
**Auth**: `withAuth`

**Request body**:
```typescript
{ text: string; owner: 'MANAGER' | 'TEAMMATE'; dueDate?: string | null }
```

**Response**:
```typescript
// 201 — created
{ commitment: Commitment }

// 409 — duplicate open commitment detected
{ duplicate: true; existingId: string }

// 400 — missing required fields
{ error: 'text and owner are required' }

// 404 — teammate not found / not owned
{ error: 'Teammate not found' }
```

**Logic**:
```
withAuth → managerId
│
├─ Verify teammate ownership → 404 if not found
├─ Validate body (text, owner required) → 400
│
└─ createCommitment(managerId, teammateId, text, owner, dueDate)
     ├─ { commitment } → 201
     └─ { duplicate: true, existingId } → 409
```

---

### LC-5.05 — `PATCH /api/commitments/[id]` (Extended)

**File**: `pages/api/commitments/[id].ts`
**Method**: PATCH
**Auth**: `withAuth`
**Patterns applied**: P-5.04 (extended action dispatch)

**Extended actions** (adds to existing `confirm` / `dismiss`):

| Action | Handled by | Result |
|--------|-----------|--------|
| `confirm` | Unit 3 `confirm()` | SUGGESTED → OPEN |
| `dismiss` | Unit 3 `dismiss()` | deleted |
| `done` | Unit 5 `updateStatus()` | → DONE |
| `carried_forward` | Unit 5 `updateStatus()` | → CARRIED_FORWARD + carryCount++ |
| `dropped` | Unit 5 `updateStatus()` | → DROPPED |

**Response** (all actions):
```typescript
// 200 — action applied
{ commitment: Commitment }   // or { success: true } for dismiss

// 400 — invalid/missing action
{ error: 'action must be one of: confirm, dismiss, done, carried_forward, dropped' }

// 404 — commitment not found / not owned
{ error: 'Commitment not found' }
```

---

### LC-5.06 — `DELETE /api/commitments/[id]`

**File**: `pages/api/commitments/[id].ts` (same file, dispatch on method)
**Method**: DELETE
**Auth**: `withAuth`

**Response**:
```typescript
// 200 — deleted
{ success: true }

// 404 — commitment not found / not owned
{ error: 'Commitment not found' }
```

---

### LC-5.07 — `GET /api/timeline/[teammateId]`

**File**: `pages/api/timeline/[teammateId].ts`
**Method**: GET
**Auth**: `withAuth`

**Response**:
```typescript
// 200
{ meetings: TimelineMeetingEntry[] }

// 404 — teammate not found / not owned
{ error: 'Teammate not found' }
```

**Note**: All meetings returned; tag filtering done client-side (P-5.05).

---

### LC-5.08 — `POST /api/timeline/[teammateId]/summary`

**File**: `pages/api/timeline/[teammateId]/summary.ts`
**Method**: POST
**Auth**: `withAuth`
**Timeout**: 10s (default — Haiku call expected ≤ 5s p95)

**Response**:
```typescript
// 200 — Claude success
{ summary: GrowthSummary }

// 200 — Claude failure (graceful degradation — P-5.02)
{ summary: null }

// 422 — no analysis-complete meetings exist
{ error: 'no_history' }

// 404 — teammate not found / not owned
{ error: 'Teammate not found' }

// 500 — DB error (not Claude error)
{ error: 'Something went wrong. Please try again.' }
```

**Logic**:
```
withAuth → managerId
│
├─ Verify teammate ownership → 404 if not found
│
└─ generateGrowthSummary(managerId, teammateId)
     ├─ EmptyHistoryError → 422
     ├─ GrowthSummary     → 200 { summary: GrowthSummary }   [P-5.02]
     └─ null (Claude fail) → 200 { summary: null }            [P-5.02]
```

---

## New Page Components

---

### LC-5.09 — `pages/teammates/[id]/commitments.tsx`

**File**: `pages/teammates/[id]/commitments.tsx`
**SSR**: Shell only (teammateName, teammateId, managerEmail)
**Client state**: openCommitments, resolvedCommitments, loading, showResolved, isAddModalOpen, toastMessage

**On mount** (parallel):
```typescript
await Promise.all([
  fetch(`/api/commitments/${teammateId}?status=open`),
  fetch(`/api/commitments/${teammateId}?status=resolved`),
])
```

**Action handler** (passed as `onAction` to CommitmentList):
```typescript
async function handleAction(id: string, action: string) {
  await fetch(`/api/commitments/${id}`, { method: 'PATCH', body: { action } })
  // Optimistic UI update: move card between lists or remove from open
}
```

**Component tree**:
```
commitments.tsx
├─ AppLayout
├─ TeammateTabNav (Profile | Timeline | Commitments* | Brief)
├─ "+ Add Commitment" button → AddCommitmentModal
├─ CommitmentList (openCommitments, showActions=true)
│    └─ CommitmentCard × N
├─ BrokenPatternSignals (openCommitments)   [P-5.03]
└─ CommitmentList (resolvedCommitments, showActions=false) [collapsible]
     └─ CommitmentCard × N
```

---

### LC-5.10 — `pages/teammates/[id]/timeline.tsx`

**File**: `pages/teammates/[id]/timeline.tsx`
**SSR**: Shell only (teammateName, teammateId, managerEmail)
**Client state**: meetings, loading, activeTag, summary, summaryLoading

**Derived values** (useMemo — P-5.05):
```typescript
const filteredMeetings = useMemo(() => activeTag
  ? meetings.filter(m => m.tags.includes(activeTag))
  : meetings, [meetings, activeTag])

const availableTags = useMemo(() => {
  const s = new Set<string>()
  meetings.forEach(m => m.tags.forEach(t => s.add(t)))
  return [...s].sort()
}, [meetings])
```

**Component tree**:
```
timeline.tsx
├─ AppLayout
├─ TeammateTabNav (Profile | Timeline* | Commitments | Brief)
├─ GrowthSummaryPanel (summary, summaryLoading, onGenerate)  [P-5.01, P-5.02]
├─ TagFilter (availableTags, activeTag, onTagSelect)          [P-5.05]
└─ TimelineList (filteredMeetings, activeTag)                 [P-5.05]
     └─ TimelineEntry × N
```

---

## New UI Components

### LC-5.11 — Component Summary

| Component | File | Patterns |
|-----------|------|---------|
| CommitmentCard | `components/commitments/CommitmentCard.tsx` | — |
| CommitmentList | `components/commitments/CommitmentList.tsx` | — |
| AddCommitmentModal | `components/commitments/AddCommitmentModal.tsx` | — |
| BrokenPatternSignals | `components/commitments/BrokenPatternSignals.tsx` | P-5.03 |
| TimelineList | `components/timeline/TimelineList.tsx` | P-5.05 |
| TimelineEntry | `components/timeline/TimelineEntry.tsx` | — |
| TagFilter | `components/timeline/TagFilter.tsx` | P-5.05 |
| GrowthSummaryPanel | `components/timeline/GrowthSummaryPanel.tsx` | P-5.01, P-5.02 |

---

## Inherited Logical Components (from Units 1–4, used by Unit 5)

| Component | File | Unit 5 Usage |
|-----------|------|-------------|
| LC-1.01 withAuth HOC | `lib/withAuth.ts` | All new API routes |
| LC-1.02 Prisma client | `lib/prisma.ts` | All DB reads/writes |
| LC-1.04 sendError | `lib/apiError.ts` | Error responses |
| LC-2.01 callClaudeWithRetry | `handlers/interviewAIHandler.ts` | Called inside `generateGrowthSummary` |
| LC-3.06 Commitments API (confirm/dismiss) | `pages/api/commitments/[id].ts` | Extended with 3 new actions (P-5.04) |

---

## Component Dependency Map

```
POST /api/commitments/[teammateId]
  └── lib/commitments.createCommitment()
        ├── Duplicate check: prisma.commitment.findFirst(OPEN + CARRIED_FORWARD, icontains text)
        └── prisma.commitment.create()

GET /api/commitments/[teammateId]
  └── lib/commitments.listOpen() / listResolved()
        └── prisma.commitment.findMany(managerId + teammateId + status filter)

PATCH /api/commitments/[id]          [P-5.04 — extended dispatch]
  ├── action=confirm  → lib/commitments.confirm()     [Unit 3]
  ├── action=dismiss  → lib/commitments.dismiss()     [Unit 3]
  └── action=done|carried_forward|dropped
        └── lib/commitments.updateStatus()
              └── prisma.commitment.update({ status, carryCount: { increment: 1 } })

DELETE /api/commitments/[id]
  └── lib/commitments.deleteCommitment()
        └── prisma.commitment.delete(managerId scope)

GET /api/timeline/[teammateId]
  └── lib/timeline.listTimeline()
        └── prisma.meeting.findMany(managerId + teammateId, all statuses, DESC)

POST /api/timeline/[teammateId]/summary
  └── lib/timeline.generateGrowthSummary()          [P-5.01, P-5.02]
        ├── Promise.all([teammate, meetings])         [P-5.01 — parallel]
        ├── buildGrowthSummaryPrompt()
        ├── callClaudeWithRetry(SUMMARY_MODEL)        [Haiku]
        ├── parseGrowthSummaryResponse()
        └── [on Claude failure] → return null         [P-5.02]
```

---

## Data Flow Diagrams

### Flow 1: Commitment Lifecycle (Carry Forward)

```
Manager views /teammates/[id]/commitments
  │
  ▼
SSR: shell (teammateName) — no commitments in SSR
  │
  ▼
useEffect → Promise.all([
  GET /api/commitments/[id]?status=open,
  GET /api/commitments/[id]?status=resolved
])
  │
  ▼
CommitmentList renders OPEN + CARRIED_FORWARD
  │
  └─► BrokenPatternSignals(openCommitments)   [P-5.03]
       └─ filter carryCount >= 2 → amber warning cards

[Manager clicks "Carry Forward"]
  │
  ▼
PATCH /api/commitments/[id] { action: 'carried_forward' }   [P-5.04]
  │
  ▼
updateStatus(managerId, id, 'carried_forward')
  └── prisma.commitment.update({ status: CARRIED_FORWARD, carryCount: { increment: 1 } })
  │
  ▼
200 { commitment }
  │
  ▼
UI: local state updated → BrokenPatternSignals re-derives   [P-5.03]
```

### Flow 2: Timeline with Tag Filter

```
Manager views /teammates/[id]/timeline
  │
  ▼
SSR: shell only
  │
  ▼
useEffect → GET /api/timeline/[teammateId]
  │
  ▼
meetings[] loaded
  │
  ├─► availableTags derived via useMemo   [P-5.05]
  └─► filteredMeetings = meetings (no filter yet)
  │
  ▼
[Manager clicks "Blocker" tag chip]
  │
  ▼
setActiveTag("Blocker")
  │
  ▼
filteredMeetings recomputed via useMemo   [P-5.05 — < 1ms, no network]
  └── meetings.filter(m => m.tags.includes("Blocker"))
  │
  ▼
TimelineList re-renders filtered list
```

### Flow 3: Growth Summary Generation

```
[Manager clicks "Generate Growth Summary"]
  │
  ▼
summaryLoading = true
  │
  ▼
POST /api/timeline/[teammateId]/summary
  │
  ▼
generateGrowthSummary(managerId, teammateId)
  │
  ├─► Promise.all([teammate, meetings])      [P-5.01 — ~100ms]
  │
  ├─► meetings.length === 0 → EmptyHistoryError → 422
  │
  ├─► buildGrowthSummaryPrompt()
  ├─► callClaudeWithRetry(SUMMARY_MODEL)     [Haiku — ~3-4s]
  ├─► parseGrowthSummaryResponse()
  │     └─ success → GrowthSummary
  │     └─ failure → return null             [P-5.02]
  │
  └─► 200 { summary: GrowthSummary | null }  [P-5.02 — always 200]
  │
  ▼
GrowthSummaryPanel:
  ├─ summary != null → render narrative, keyThemes, growthSignals, coachingGaps
  └─ summary == null → "Growth summary unavailable. Try again later."
```
