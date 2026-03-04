# Business Rules — Unit 4: Intelligence Engine

**Date**: 2026-03-02
**Unit**: Unit 4: Intelligence Engine

---

## Pattern Detection Rules

### BR-4.01 — Minimum Meeting Threshold
Pattern detection requires at least **2** `ANALYSIS_COMPLETE` meetings for a teammate before running.
- Enforcement: PatternDetectionHandler returns early if `meetings.length < 2`
- UI: Empty state message shown in Patterns section: "Not enough meeting data yet. Patterns will appear after 2 or more meetings are recorded."

### BR-4.02 — Pattern Severity Classification
Claude must classify each detected pattern into exactly one of three severities:
- `INFORMATIONAL` — trend worth tracking, no immediate action
- `WATCH` — pattern emerging, may need coaching attention
- `ACTION_REQUIRED` — recurring issue requiring direct coaching intervention
- Enforcement: parsePatternResponse filters any severity not in `VALID_SEVERITIES = ['INFORMATIONAL', 'WATCH', 'ACTION_REQUIRED']`; invalid entries are dropped.

### BR-4.03 — Pattern Evidence Integrity
Every Pattern row must include evidence with at least one meeting ID.
- Evidence JSON must contain `meetingIds` (non-empty array), `dates`, and `tags`.
- Enforcement: PatternDetectionHandler validates evidence before upsert; patterns with empty evidence are skipped.

### BR-4.04 — Pattern Deduplication
Two patterns for the same teammate are considered duplicates if:
- Same severity AND
- At least 2 overlapping tags in evidence
On duplicate: update description, merge meeting IDs into evidence, refresh `detectedAt`.
On new: create new Pattern row.

### BR-4.05 — Pattern Detection Failure Isolation
If PatternDetectionHandler throws (Claude error, parse error), the error is caught and logged but does NOT cause the cron function to fail. The meeting remains `ANALYSIS_COMPLETE`.

---

## Brief Generation Rules

### BR-4.06 — No Meeting History Guard
If a teammate has zero `ANALYSIS_COMPLETE` meetings:
- `POST /api/brief/[teammateId]/generate` returns 422 with `{ error: 'no_history' }`
- UI renders: "No meeting history yet. Complete at least one meeting to generate a brief." with a prompt to add a meeting.

### BR-4.07 — Brief Not Persisted
Generated briefs are never stored in the database. Each call to `generate` produces a fresh brief from current data. This ensures data freshness.

### BR-4.08 — Brief Completeness Requirements
A valid brief response from Claude must include:
- `contextSummary` (non-empty string)
- `coachingFocus` (non-empty string)
- `followUpQuestions` (array, 5–7 items)
- `uncomfortableQuestion` (non-empty string)
- `riskSignals` (array, may be empty)
If any required field is missing/empty after parse, the response is treated as a parse failure and the fallback is returned.

### BR-4.09 — Brief Fallback Content
When BriefGenerationHandler fails (any reason):
- Return `{ brief: null, fallback: BriefFallback }` — never return a blank page
- Fallback must include: open + carried-forward commitments, last meeting summary (if available)
- UI renders fallback section with message: "Brief generation failed. Here is a summary of open commitments and last meeting notes to help you prepare."

### BR-4.10 — Patterns in Brief — Severity Filter
Only `WATCH` and `ACTION_REQUIRED` patterns appear in the brief's active patterns section.
`INFORMATIONAL` patterns are available via the standalone Patterns view (US-09) but not surfaced in the brief to avoid noise.

### BR-4.11 — Commitment Status Filter for Brief
Brief includes commitments with status `OPEN` or `CARRIED_FORWARD` only.
`DONE`, `DROPPED`, and `SUGGESTED` commitments are excluded from the brief.

### BR-4.12 — Regeneration is Idempotent
Regenerating a brief (US-11) calls the same `POST /api/brief/[teammateId]/generate` endpoint. No state is mutated. The UI replaces the displayed brief with the new response.

---

## Coaching Strategy Rules

### BR-4.13 — Framework Selection Basis
CoachingStrategyHandler selects a framework using:
- Teammate profile fields (feedbackStyle, motivationDrivers, growthAreas)
- Recent patterns (last 5, ordered by severity DESC)
- Open commitment carryCount distribution
Rationale must be 2–3 sentences explaining the fit for this specific person.

### BR-4.14 — Coaching Framework Fallback
If Claude cannot select a framework (low confidence, parse error, service error):
- Return the generic fallback approach (no framework name)
- Fallback text: "Not enough context to recommend a specific framework. Consider asking open-ended questions about what's going well and what feels hard right now."
- This does NOT cause the brief to fail — the coachingApproach section shows the fallback message.

### BR-4.15 — Valid Coaching Frameworks
Only frameworks from the catalog may be selected:
`['GROW', 'SBI', 'STRENGTHS', 'OSCAR', 'SOCRATIC', 'MOTIVATIONAL']`
Any framework name returned by Claude not in this list is replaced by the fallback.

---

## Data Access Rules

### BR-4.16 — Manager Isolation
All DB reads in Unit 4 must include `managerId` in the WHERE clause. A manager may only access patterns, meetings, and commitments for their own teammates.
- Enforcement: All lib functions accept `managerId` and include it in every Prisma query.

### BR-4.17 — Ownership Verification for Brief
`POST /api/brief/[teammateId]/generate` must verify that `teammate.managerId === managerId` before generating the brief.
- Returns 404 if the teammate doesn't belong to the authenticated manager.

---

## Validation Rules

### BR-4.18 — Pattern Claude Response Validation
Pattern Claude response must parse to an array. Each item must have:
- `description` (string, non-empty)
- `severity` (one of VALID_SEVERITIES)
- `evidence.tags` (string array)
Invalid items are silently dropped; if all items invalid → no patterns upserted (not an error).

### BR-4.19 — Brief Claude Response Validation
Brief Claude response must parse to an object with all required fields (BR-4.08).
If validation fails → trigger fallback path (BR-4.09).

### BR-4.20 — Maximum Pattern Count per Teammate
No more than **10** Pattern rows stored per teammate. If `detectPatterns` would create an 11th unique pattern, the least severe / oldest pattern is deleted first (LRU + severity-weighted eviction). This prevents unbounded table growth.
