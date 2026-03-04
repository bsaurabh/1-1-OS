# NFR Design Patterns — Unit 5: Tracker & Timeline

**Date**: 2026-03-02
**Unit**: Unit 5: Tracker & Timeline

---

## P-5.01 — Parallel DB Pre-fetch for Growth Summary

**Addresses**: Performance — growth summary must complete ≤ 5s p95; DB reads must not add sequential latency

**Context**: `generateGrowthSummary` needs both the teammate record (name, profile) and meeting summaries before calling Claude. Sequential reads would add ~200ms; parallel reduces to ~100ms, preserving the latency budget.

**Pattern**:
```typescript
export async function generateGrowthSummary(
  managerId: string,
  teammateId: string,
  client?: Anthropic
): Promise<GrowthSummary | null> {
  // All reads in parallel before entering Claude call
  const [teammate, meetings] = await Promise.all([
    prisma.teammate.findFirst({
      where: { id: teammateId, managerId },
      select: { name: true, profile: true },
    }),
    prisma.meeting.findMany({
      where: { managerId, teammateId, status: 'ANALYSIS_COMPLETE' },
      orderBy: { createdAt: 'asc' },
      take: MAX_MEETINGS_FOR_SUMMARY,
      select: { summary: true, tags: true, tone: true, createdAt: true },
    }),
  ])

  if (!teammate) throw new Error('Teammate not found')
  if (meetings.length === 0) throw new EmptyHistoryError()

  // Build prompt and call Claude (Haiku)
  ...
}
```

**Budget breakdown**:
- `Promise.all` DB reads: ~100ms
- Haiku call (max_tokens: 1500): ~3–4s
- Parse + assemble: ~50ms
- Total p95: ~4–5s ✓

---

## P-5.02 — Graceful Degradation for Growth Summary

**Addresses**: Reliability — growth summary page must never show an error state; Claude failures are non-critical

**Context**: Growth summary is a convenience feature, not a core workflow. If Claude fails, the manager can still view the timeline. The API route must always return 200 (never 500 for Claude failures).

**Pattern**:
```typescript
// lib/timeline.ts
export async function generateGrowthSummary(managerId, teammateId, client?) {
  const [teammate, meetings] = await Promise.all([...])
  if (meetings.length === 0) throw new EmptyHistoryError()

  try {
    const prompt = buildGrowthSummaryPrompt(teammate, meetings)
    const message = await callClaudeWithRetry(() =>
      anthropic.messages.create({ model: SUMMARY_MODEL, max_tokens: 1500, ... })
    )
    const parsed = parseGrowthSummaryResponse(message.content[0].text)
    return { teammateName: teammate.name, generatedAt: new Date().toISOString(), ...parsed }
  } catch (err) {
    // P-5.02: Log failure but return null — caller wraps in { summary: null }
    console.error('[growthSummary] generation failed:', err)
    return null
  }
}

// pages/api/timeline/[teammateId]/summary.ts
try {
  const summary = await generateGrowthSummary(managerId, teammateId)
  return res.status(200).json({ summary })   // null or GrowthSummary — always 200
} catch (err) {
  if (err instanceof EmptyHistoryError) return res.status(422).json({ error: 'no_history' })
  return sendError(res, 500, INTERNAL_ERROR)  // Only for DB errors, not Claude errors
}
```

**Response shape**:
```typescript
// Claude success:  { summary: GrowthSummary }
// Claude failure:  { summary: null }          — UI shows "Try again later"
// No history:      422 { error: 'no_history' } — UI shows "Add meetings first"
```

---

## P-5.03 — Read-Time Derived Pattern Signal

**Addresses**: Reliability + Data integrity — broken commitment signal must stay fresh and not pollute the Pattern table

**Context**: When a commitment is carried forward ≥ 2 times, a pattern signal is shown in the Patterns section. Rather than writing a Pattern row (which would be managed by PatternDetectionHandler's AI dedup/eviction logic), this signal is derived live from commitment data.

**Pattern**:
```typescript
// components/commitments/BrokenPatternSignals.tsx
export default function BrokenPatternSignals({ commitments }: { commitments: Commitment[] }) {
  const broken = commitments.filter(c => c.carryCount >= 2)
  if (broken.length === 0) return null

  return (
    <div data-testid="broken-pattern-signals">
      {broken.map((c, i) => (
        <div key={c.id} data-testid={`broken-pattern-signal-${i}`}
             className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          Commitment "{c.text.slice(0, 60)}{c.text.length > 60 ? '…' : ''}" has been
          carried forward {c.carryCount} times — consider discussing this directly.
        </div>
      ))}
    </div>
  )
}

// pages/teammates/[id]/index.tsx — also shown in Patterns section
// Rendered below PatternList with its own subsection header
```

**Properties**:
- Always reflects latest carryCount (no staleness possible)
- Zero DB writes — pure read-time derivation
- Pattern table remains exclusively AI-managed (PatternDetectionHandler)

---

## P-5.04 — Extended Action Dispatch for Commitment Mutations

**Addresses**: Maintainability — consolidate all commitment state changes in one route

**Context**: `PATCH /api/commitments/[id]` already dispatches on `action` (confirm, dismiss). Unit 5 adds three new lifecycle actions. Extending the dispatch is preferable to creating separate routes that would fragment commitment mutation logic.

**Pattern**:
```typescript
// pages/api/commitments/[id].ts (extended)
async function handler(req, res, managerId) {
  if (req.method !== 'PATCH') return sendError(res, 405 as never, 'Method not allowed')

  const id = req.query.id as string
  const { action, text } = req.body as { action?: string; text?: string }

  // Unit 3 actions (existing)
  if (action === 'confirm') {
    const commitment = await confirm(managerId, id, text)
    if (!commitment) return sendError(res, 404, 'Commitment not found')
    return res.status(200).json({ commitment })
  }
  if (action === 'dismiss') {
    const deleted = await dismiss(managerId, id)
    if (!deleted) return sendError(res, 404, 'Commitment not found')
    return res.status(200).json({ success: true })
  }

  // Unit 5 actions (new)
  if (action === 'done' || action === 'carried_forward' || action === 'dropped') {
    const commitment = await updateStatus(managerId, id, action)
    if (!commitment) return sendError(res, 404, 'Commitment not found')
    return res.status(200).json({ commitment })
  }

  return sendError(res, 400, 'action must be one of: confirm, dismiss, done, carried_forward, dropped')
}
```

**All valid actions in one place**:
| Action | From Status | Result |
|--------|-------------|--------|
| confirm | SUGGESTED | OPEN |
| dismiss | SUGGESTED | deleted |
| done | OPEN, CARRIED_FORWARD | DONE |
| carried_forward | OPEN, CARRIED_FORWARD | CARRIED_FORWARD + carryCount++ |
| dropped | OPEN, CARRIED_FORWARD | DROPPED |

---

## P-5.05 — Client-Side Collection Filter

**Addresses**: Performance + UX — tag filter must respond instantly without a server round-trip

**Context**: The timeline fetches all meetings once via `GET /api/timeline/[teammateId]`. The tag filter is applied client-side in React state. This eliminates network latency on every filter change and simplifies server logic.

**Pattern**:
```typescript
// pages/teammates/[id]/timeline.tsx
const [meetings, setMeetings] = useState<TimelineMeetingEntry[]>([])
const [activeTag, setActiveTag] = useState<string | null>(null)

// Derived — computed from meetings state, no refetch needed
const filteredMeetings = useMemo(() => {
  if (!activeTag) return meetings
  return meetings.filter(m => m.tags.includes(activeTag))
}, [meetings, activeTag])

// All available tags derived from fetched data
const availableTags = useMemo(() => {
  const tagSet = new Set<string>()
  meetings.forEach(m => m.tags.forEach(t => tagSet.add(t)))
  return [...tagSet].sort()
}, [meetings])

// TagFilter receives derived data — no server state
return (
  <>
    <TagFilter
      availableTags={availableTags}
      activeTag={activeTag}
      onTagSelect={setActiveTag}
    />
    <TimelineList meetings={filteredMeetings} activeTag={activeTag} />
  </>
)
```

**Properties**:
- Filter response: < 1ms (synchronous JavaScript)
- Single API call on page load regardless of how many filter changes the user makes
- `useMemo` prevents redundant re-computation on unrelated re-renders

---

## Pattern Interaction Diagram

```
[Manager views /teammates/[id]/commitments]
  │
  ▼
SSR: shell only (teammateName, teammateId, managerEmail)
  │
  ▼
useEffect → GET /api/commitments/[teammateId]?status=open
         → GET /api/commitments/[teammateId]?status=resolved
  │
  ▼
CommitmentList renders all OPEN + CARRIED_FORWARD
  │
  └─► BrokenPatternSignals(commitments)  [P-5.03 — read-time derivation]
       └─ filter carryCount >= 2
       └─ renders amber warning cards

[Manager clicks "Carry Forward" on CommitmentCard]
  │
  ▼
PATCH /api/commitments/[id] { action: 'carried_forward' }   [P-5.04]
  │
  ▼
updateStatus(managerId, id, 'carried_forward')
  │
  ▼
prisma.commitment.update({ status: CARRIED_FORWARD, carryCount: n+1 })
  │
  ▼
200 { commitment: updatedCommitment }
  │
  ▼
UI updates local state → BrokenPatternSignals re-evaluates  [P-5.03]

──────────────────────────────────────────────────────

[Manager views /teammates/[id]/timeline]
  │
  ▼
SSR: shell only
  │
  ▼
useEffect → GET /api/timeline/[teammateId]
  │
  ▼
meetings[] loaded → availableTags derived via useMemo  [P-5.05]
  │
  ▼
[Manager clicks "Blocker" tag filter]
  │
  ▼
setActiveTag("Blocker")
  │
  ▼
filteredMeetings = meetings.filter(m => m.tags.includes("Blocker"))  [P-5.05 — instant]
  │
  ▼
TimelineList re-renders filtered list

──────────────────────────────────────────────────────

[Manager clicks "Generate Growth Summary"]
  │
  ▼
POST /api/timeline/[teammateId]/summary
  │
  ▼
generateGrowthSummary(managerId, teammateId)
  │
  ├─► Promise.all([teammate, meetings])    [P-5.01]
  │
  ├─► callClaudeWithRetry(SUMMARY_MODEL)   [Haiku, ≤5s]
  │     └─ on failure → return null        [P-5.02]
  │
  └─► 200 { summary: GrowthSummary | null }  [P-5.02]
       └─ null → UI shows "Try again later"
```
