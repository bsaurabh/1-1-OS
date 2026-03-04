# Business Logic Model — Unit 5: Tracker & Timeline

**Date**: 2026-03-02
**Unit**: Unit 5: Tracker & Timeline

---

## CommitmentTracker (extends lib/commitments.ts)

### createCommitment(managerId, teammateId, input) → Commitment

```
Algorithm:
1. Validate input.text is non-empty (trimmed length > 0)
2. Verify teammate ownership: prisma.teammate.findFirst({ where: { id: teammateId, managerId } })
   → If not found: throw TeammateNotFoundError
3. Duplicate detection:
   a. Query prisma.commitment.findMany where { managerId, teammateId, status: { in: [OPEN, CARRIED_FORWARD] } }
   b. For each existing: if normalize(existing.text) === normalize(input.text) → throw DuplicateCommitmentError with existingId
   c. normalize = text.trim().toLowerCase()
4. Create: prisma.commitment.create({
     data: { managerId, teammateId, text, owner, status: OPEN, dueDate: input.dueDate ?? null, meetingId: null }
   })
5. Return created commitment
```

### updateStatus(managerId, id, action) → Commitment

Valid actions: `done` | `carried_forward` | `dropped`

```
Algorithm:
1. Fetch: prisma.commitment.findFirst({ where: { id, managerId } })
   → If not found: return null (caller sends 404)
2. Validate action against current status:
   - done: allowed from OPEN or CARRIED_FORWARD
   - carried_forward: allowed from OPEN or CARRIED_FORWARD
   - dropped: allowed from OPEN or CARRIED_FORWARD
   → If invalid transition: throw InvalidTransitionError
3. Compute new state:
   - done → { status: DONE }
   - carried_forward → { status: CARRIED_FORWARD, carryCount: current + 1 }
   - dropped → { status: DROPPED }
4. Update: prisma.commitment.update({ where: { id }, data: newState })
5. Return updated commitment
```

### listOpen(managerId, teammateId) → Commitment[]

```
Algorithm:
1. Query: prisma.commitment.findMany({
     where: { managerId, teammateId, status: { in: [OPEN, CARRIED_FORWARD] } },
     orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
   })
2. Return sorted list (CARRIED_FORWARD first to highlight outstanding items)
```

### listResolved(managerId, teammateId) → Commitment[]

```
Algorithm:
1. Query: prisma.commitment.findMany({
     where: { managerId, teammateId, status: { in: [DONE, DROPPED] } },
     orderBy: { updatedAt: 'desc' },
     take: 20   // limit resolved history
   })
2. Return list
```

### deleteCommitment(managerId, id) → boolean

```
Algorithm:
1. Fetch: prisma.commitment.findFirst({ where: { id, managerId } })
   → If not found: return false
2. Only SUGGESTED, OPEN, or DROPPED commitments may be deleted (DONE/CARRIED_FORWARD require explicit resolution)
   → If status is DONE or CARRIED_FORWARD: throw CannotDeleteActiveError
3. prisma.commitment.delete({ where: { id } })
4. Return true
```

Note: In practice, the UI only shows delete for SUGGESTED and DROPPED. OPEN/CARRIED_FORWARD commitments use resolve actions.

---

## GrowthTimeline (lib/timeline.ts — new)

### listTimeline(managerId, teammateId, tagFilter?) → TimelineMeetingEntry[]

```
Algorithm:
1. Verify teammate ownership: prisma.teammate.findFirst({ where: { id: teammateId, managerId } })
   → If not found: throw TeammateNotFoundError
2. Query: prisma.meeting.findMany({
     where: { managerId, teammateId },
     orderBy: { createdAt: 'desc' },
     select: { id, source, status, summary, tags, createdAt }
   })
3. If tagFilter is provided:
   a. Filter to meetings where tags includes tagFilter
   b. (Meetings with no tags are excluded when a filter is active)
4. Map to TimelineMeetingEntry[]
5. Return list
```

### generateGrowthSummary(managerId, teammateId, client?) → GrowthSummary

```
Algorithm:
1. Parallel DB fetch (P-5.01):
   [teammate, meetings] = await Promise.all([
     prisma.teammate.findFirst({ where: { id: teammateId, managerId }, select: { name, profile } }),
     prisma.meeting.findMany({
       where: { managerId, teammateId, status: ANALYSIS_COMPLETE },
       orderBy: { createdAt: 'asc' },
       select: { summary, tags, tone, createdAt }
     })
   ])
2. Guard: if meetings.length === 0 → throw EmptyHistoryError
3. Build prompt:
   - Include teammate name and profile
   - Include all meeting summaries in chronological order (up to 10, truncated at 500 chars each)
   - Aggregate tag frequencies
   - Ask Claude to produce: narrative (2-3 paragraphs), keyThemes[], growthSignals[], coachingGaps[]
4. Call Claude (claude-haiku-4-5-20251001) with callClaudeWithRetry
5. Parse response (JSON object with 4 required fields)
6. Return GrowthSummary { teammateName: teammate.name, generatedAt, narrative, keyThemes, growthSignals, coachingGaps }

Failure path (P-5.02 Graceful Degradation):
→ If Claude fails or parse fails: return GrowthSummary with narrative = null, arrays empty
→ UI shows: "Growth summary unavailable. Try again later."
```

---

## API Layer Logic

### POST /api/commitments/[teammateId]

```
1. Validate method === POST
2. Extract { text, owner, dueDate } from req.body
3. Validate: text non-empty string; owner in [MANAGER, TEAMMATE]
4. Call createCommitment(managerId, teammateId, { text, owner, dueDate })
5. DuplicateCommitmentError → 409 { duplicate: true, existingId }
6. TeammateNotFoundError → 404
7. Success → 201 { commitment }
```

### PATCH /api/commitments/[id] (extended — unit 5 actions added)

```
Existing (Unit 3): action in [confirm, dismiss]
New (Unit 5): action in [done, carried_forward, dropped]

Combined handler:
1. action in [confirm, dismiss] → use existing confirm/dismiss logic
2. action in [done, carried_forward, dropped] → call updateStatus(managerId, id, action)
   - null return → 404
   - InvalidTransitionError → 400
   - Success → 200 { commitment }
```

### DELETE /api/commitments/[id]

```
1. Validate method === DELETE
2. Call deleteCommitment(managerId, id)
3. false → 404
4. CannotDeleteActiveError → 400
5. Success → 200 { success: true }
```

### GET /api/timeline/[teammateId]

```
1. Validate method === GET
2. tagFilter = req.query.tag as string | undefined
3. Call listTimeline(managerId, teammateId, tagFilter)
4. TeammateNotFoundError → 404
5. Success → 200 { meetings, count }
```

### POST /api/timeline/[teammateId]/summary

```
1. Validate method === POST
2. Call generateGrowthSummary(managerId, teammateId)
3. EmptyHistoryError → 422 { error: 'no_history' }
4. Failure → 200 { summary: null } (graceful degradation)
5. Success → 200 { summary: GrowthSummary }
```
