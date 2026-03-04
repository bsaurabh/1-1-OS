# Business Rules — Unit 5: Tracker & Timeline

**Date**: 2026-03-02
**Unit**: Unit 5: Tracker & Timeline

---

## Commitment Lifecycle Rules

### BR-5.01 — Commitment Creation — Required Fields
Manual commitment creation requires:
- `text` — non-empty string (trimmed length > 0)
- `owner` — one of `MANAGER` or `TEAMMATE`
- `dueDate` is optional; if provided, must be a valid ISO date string

### BR-5.02 — Manual Commitment Initial Status
Commitments created via `POST /api/commitments/[teammateId]` are created with status `OPEN` directly. They bypass the `SUGGESTED` state (which is reserved for AI-extracted commitments).

### BR-5.03 — Duplicate Commitment Detection
Before creating a manual commitment, check for existing OPEN or CARRIED_FORWARD commitments for the same teammate with identical text (case-insensitive, trimmed).
- If duplicate exists: return 409 `{ duplicate: true, existingId }` to let the client handle the conflict.
- Client shows: "A similar open commitment already exists. Do you want to add another or update the existing one?"

### BR-5.04 — Status Transition Matrix
Valid transitions for PATCH actions:

| Current Status   | Action            | New Status       | carryCount |
|-----------------|-------------------|-----------------|------------|
| OPEN            | done              | DONE             | unchanged  |
| OPEN            | carried_forward   | CARRIED_FORWARD  | +1         |
| OPEN            | dropped           | DROPPED          | unchanged  |
| CARRIED_FORWARD | done              | DONE             | unchanged  |
| CARRIED_FORWARD | carried_forward   | CARRIED_FORWARD  | +1         |
| CARRIED_FORWARD | dropped           | DROPPED          | unchanged  |
| SUGGESTED       | confirm           | OPEN             | unchanged  |
| SUGGESTED       | dismiss           | (deleted)        | —          |

Any other transition is invalid → 400 error.

### BR-5.05 — carryCount Increment
When a commitment is carried forward (action = `carried_forward`):
- Status is set to `CARRIED_FORWARD`
- `carryCount` is incremented by 1 (regardless of whether it was previously OPEN or CARRIED_FORWARD)
- carryCount is a running total of how many times the commitment has been carried

### BR-5.06 — Broken Commitment Pattern Signal
A commitment is considered a "broken pattern" when `carryCount >= 2`.
- Surface in: Patterns section on teammate profile (as a separate subsection), Pre-Meeting Brief (already handled in Unit 4 via CommitmentListMini carryCount badge)
- Signal text: "Commitment '[text truncated to 60 chars]' has been carried forward [N] times — consider discussing this directly."
- This signal is derived at read time, NOT stored as a Pattern row.

### BR-5.07 — Commitment Deletion Restrictions
A commitment may be hard-deleted only if its status is:
- `SUGGESTED` (before confirmation)
- `DROPPED` (already resolved as dropped)

Commitments with status `OPEN`, `CARRIED_FORWARD`, or `DONE` may NOT be hard-deleted. Use the status update actions instead.

### BR-5.08 — Manager Isolation for Commitments
All commitment operations must include `managerId` in WHERE clauses. Managers may only access commitments for their own teammates.

---

## Timeline Rules

### BR-5.09 — Timeline Shows All Meetings
The timeline shows ALL meetings for a teammate regardless of analysis status (`PENDING_ANALYSIS`, `ANALYSIS_COMPLETE`, `ANALYSIS_FAILED`).
- ANALYSIS_COMPLETE: show summary and tags
- PENDING_ANALYSIS: show "Analysis in progress…" instead of summary, no tags
- ANALYSIS_FAILED: show "Analysis failed." instead of summary, no tags

### BR-5.10 — Tag Filter Only Applies to Tagged Meetings
When a tag filter is active:
- Return only `ANALYSIS_COMPLETE` meetings that include the selected tag in their `tags` array
- Display filtered count: "[N] meetings tagged [tag]"
- Meetings without the tag are hidden while filter is active

### BR-5.11 — Timeline Sort Order
Meetings are displayed in reverse-chronological order (most recent first). No pagination in MVP — all meetings are loaded at once.

### BR-5.12 — Manager Isolation for Timeline
Timeline queries include `managerId` in WHERE clause. A manager may only view meeting history for their own teammates.

---

## Growth Summary Rules

### BR-5.13 — Growth Summary Requires Analysis-Complete Meetings
`generateGrowthSummary` requires at least 1 `ANALYSIS_COMPLETE` meeting.
- If 0 ANALYSIS_COMPLETE meetings: `POST /api/timeline/[teammateId]/summary` returns 422 `{ error: 'no_history' }`

### BR-5.14 — Growth Summary Not Persisted
Growth summaries are generated on-demand and never stored in the database. Each call produces a fresh summary from current data (same as Brief — BR-4.07).

### BR-5.15 — Growth Summary Graceful Degradation
If Claude fails or the response cannot be parsed:
- Return 200 `{ summary: null }` (not an error state)
- UI shows: "Growth summary unavailable. Try again later."

### BR-5.16 — Growth Summary Claude Model
Uses `claude-haiku-4-5-20251001` (Haiku) for cost efficiency. Growth summaries synthesize text but do not require the depth of brief generation.

### BR-5.17 — Growth Summary Scope
Summary is based on up to 10 most recent `ANALYSIS_COMPLETE` meetings (same cap as brief generation: MAX_MEETINGS_FOR_BRIEF = 10).

---

## UI Rules

### BR-5.18 — Commitments Page Default View
The commitments page defaults to showing OPEN and CARRIED_FORWARD commitments.
- DONE and DROPPED commitments are shown in a collapsed "Resolved" section (last 20, ordered by updatedAt desc)
- User can toggle the resolved section open/closed

### BR-5.19 — Due Date Display
If a commitment has a `dueDate`:
- Show the formatted due date next to the commitment
- If the due date has passed and status is still OPEN or CARRIED_FORWARD, highlight it in red ("Overdue")

### BR-5.20 — Add Commitment from Commitments Page
The commitments page includes an "Add Commitment" button that opens a modal. The modal has:
- Owner toggle: Manager / Teammate (default: Manager)
- Text field (required)
- Due date field (optional)
- "Save" button (disabled while empty)
- On 409 response: show duplicate dialog

### BR-5.21 — Timeline Navigation
The teammate profile page `pages/teammates/[id]/index.tsx` already links to brief. Unit 5 adds navigation links to the Timeline page and Commitments page. These are rendered as tab-style links below the teammate name.
