# NFR Requirements — Unit 5: Tracker & Timeline

**Date**: 2026-03-02
**Unit**: Unit 5: Tracker & Timeline

---

## Performance

| Requirement | Target | Enforcement |
|-------------|--------|-------------|
| Commitment status update (p95) | ≤ 200ms | Single Prisma UPDATE; no Claude call |
| Manual commitment creation (p95) | ≤ 300ms | Duplicate check (one Prisma SELECT) + one Prisma CREATE |
| Timeline list load (p95) | ≤ 500ms | Prisma findMany on (managerId, teammateId) with indexed columns; no AI call |
| Growth summary generation (p95) | ≤ 5s | Claude Haiku; up to 10 meeting summaries; ~3–4s typical |
| Commitments page load (p95) | ≤ 500ms | Two Prisma queries (open + resolved); SSR shell + client fetch |
| Tag filter response | < 50ms | Client-side filter (already fetched); no additional API call |

**Growth Summary Budget** (total ≤ 5s target):
- DB reads in parallel (teammate + meetings): ~100ms
- Haiku call (max_tokens: 1500): ~3–4s
- Parse + response: ~50ms
- Total p95: ~4–5s

---

## Reliability

| Requirement | Specification |
|-------------|---------------|
| Growth summary graceful degradation | Always returns 200; if Claude fails: `{ summary: null }` (P-5.02) |
| Commitment duplicate detection | Returns 409 with `{ duplicate: true }` — never silently drops data |
| Status transition validation | Invalid transitions return 400 — never corrupt commitment state |
| Claude retry (growth summary) | 1 inner retry for transient 5xx/429 errors (same `callClaudeWithRetry` pattern) |
| Empty history guard (growth summary) | Returns 422 if no ANALYSIS_COMPLETE meetings — clear feedback to user |

---

## Security

| Requirement | Specification |
|-------------|---------------|
| Manager isolation — commitments | All commitment operations filter by `managerId`; PATCH and DELETE verify ownership before mutation |
| Manager isolation — timeline | All timeline reads filter by `managerId` via teammate ownership check |
| API authentication | `withAuth` HOC on all new routes (same pattern as Units 1–4) |
| No new env vars | No additional secrets required |
| Input validation — commitment text | Text validated as non-empty string before DB write; no further sanitization needed (stored as-is, never executed) |

---

## Scalability

| Requirement | Specification |
|-------------|---------------|
| Timeline list size | All meetings loaded in one query (MVP; no pagination); expected ≤ 50 meetings per teammate at current scale |
| Resolved commitment history | Capped at 20 most recent DONE/DROPPED entries in `listResolved()`; prevents large payload |
| Growth summary meeting input | Capped at 10 most recent ANALYSIS_COMPLETE meetings (MAX_MEETINGS_FOR_BRIEF constant re-used) |
| Stateless commitment operations | No server-side state; scales horizontally via Vercel serverless |

---

## Availability

| Requirement | Specification |
|-------------|---------------|
| Commitment endpoints uptime | Vercel serverless (same as all routes); no special HA requirement |
| Growth summary availability | On-demand; degradation path defined (returns null, not error) |
| No new infrastructure | Unit 5 adds no new external services |

---

## Maintainability

| Requirement | Specification |
|-------------|---------------|
| Commitment lib extension | New functions added to `lib/commitments.ts`; existing `saveSuggested`, `confirm`, `dismiss`, `listSuggested` functions unchanged |
| Timeline lib new file | `lib/timeline.ts` (new); follows same pattern as other lib files: injectable client for tests |
| API route extension pattern | `PATCH /api/commitments/[id]` extended in-place — new actions branch off existing action dispatch |
| Test coverage | Unit tests for all new lib functions + new routes + growth summary handler |

---

## Usability

| Requirement | Specification |
|-------------|---------------|
| Action feedback — commitment update | Button enters loading state during PATCH; replaced with confirmation on success |
| Duplicate commitment warning | 409 response renders inline dialog: "A similar open commitment exists. Add another or update existing?" |
| Broken pattern visibility | Amber indicator shown for carryCount ≥ 2 on CommitmentCard and BrokenPatternSignals |
| Tag filter — active state | Selected tag chip is visually distinguished (filled vs outlined); count shown |
| Growth summary loading | Spinner + "Generating summary…" during Haiku call |
| Overdue commitment | Red "Overdue" label on commitments past their due date |
| Resolved section toggle | "Show resolved (N)" / "Hide resolved" button with count |

---

## Technical Debt

| ID | Item | Impact |
|----|------|--------|
| TD-17 | No timeline pagination | Large meeting histories (100+) will load slowly; acceptable for MVP, add cursor pagination in v2 |
| TD-18 | Client-side tag filter | Tag chips derived from fetched meetings; adding a new meeting requires page refresh to update available tags |
| TD-19 | Growth summary not cached | Each "Generate" click makes a new Haiku call; add 5-min cache in v2 |
| TD-20 | No confirmation dialog for commitment status changes | Done/Drop is immediate; accidental clicks cannot be undone easily |
