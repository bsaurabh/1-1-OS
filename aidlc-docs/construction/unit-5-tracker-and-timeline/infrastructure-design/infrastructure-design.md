# Infrastructure Design — Unit 5: Tracker & Timeline

**Date**: 2026-03-02
**Unit**: Unit 5: Tracker & Timeline
**Stories**: US-13, US-14, US-15

---

## Infrastructure Overview

Unit 5 is **zero new infrastructure**. It introduces no new external services, no new environment variables, no new npm packages, and no Vercel configuration changes. All new pages and API routes run on the existing Vercel + Supabase PostgreSQL + Anthropic Claude API stack.

The only infrastructure surface is 4 new API routes and 2 new pages, all using the default 10s Vercel timeout. One existing route (`PATCH /api/commitments/[id]`) is extended with new action values — no infra change required.

```
Developer / Browser
      |
      v
  Vercel Edge Network (CDN + routing)
      |
      |-- Static assets (.next/static/) ───────────────────── Vercel CDN
      |
      |-- SSR: /teammates/[id]/commitments        [NEW Unit 5 — shell only]
      |       --> Vercel Serverless Function (10s default)
      |               --> Supabase PostgreSQL (teammate ownership check only)
      |
      |-- SSR: /teammates/[id]/timeline           [NEW Unit 5 — shell only]
      |       --> Vercel Serverless Function (10s default)
      |               --> Supabase PostgreSQL (teammate ownership check only)
      |
      |-- SSR: /teammates/[id]                    [MODIFIED Unit 5 — tab nav only]
      |       --> Vercel Serverless Function (10s default)
      |               --> Supabase PostgreSQL (unchanged reads)
      |
      |-- API: GET  /api/commitments/[teammateId] [NEW Unit 5]
      |       --> Vercel Serverless Function (10s default)
      |               --> Supabase PostgreSQL (commitment reads)
      |
      |-- API: POST /api/commitments/[teammateId] [NEW Unit 5]
      |       --> Vercel Serverless Function (10s default)
      |               --> Supabase PostgreSQL (commitment create + duplicate check)
      |
      |-- API: PATCH /api/commitments/[id]        [EXTENDED Unit 5 — new actions only]
      |       --> Vercel Serverless Function (10s default)
      |               --> Supabase PostgreSQL (commitment update)
      |
      |-- API: DELETE /api/commitments/[id]       [NEW Unit 5]
      |       --> Vercel Serverless Function (10s default)
      |               --> Supabase PostgreSQL (commitment delete)
      |
      |-- API: GET  /api/timeline/[teammateId]    [NEW Unit 5]
      |       --> Vercel Serverless Function (10s default)
      |               --> Supabase PostgreSQL (meeting reads — all statuses)
      |
      |-- API: POST /api/timeline/[teammateId]/summary  [NEW Unit 5]
              --> Vercel Serverless Function (10s default)
                      --> Supabase PostgreSQL (teammate + meeting reads — parallel)
                      --> Anthropic Claude API (Haiku: growth summary, ≤5s p95)
```

---

## 1. Compute: Vercel Serverless Functions

### New and Modified Route-to-Function Mapping (Unit 5)

| Route | Function File | Max Duration | Change | Notes |
|-------|--------------|-------------|--------|-------|
| `GET /teammates/[id]/commitments` | `pages/teammates/[id]/commitments.tsx` | 10s (default) | NEW | Shell only — ownership check; commitments fetched client-side |
| `GET /teammates/[id]/timeline` | `pages/teammates/[id]/timeline.tsx` | 10s (default) | NEW | Shell only — ownership check; meetings fetched client-side |
| `GET /teammates/[id]` | `pages/teammates/[id]/index.tsx` | 10s (default) | MODIFIED | Tab nav addition only — no new SSR reads |
| `GET /api/commitments/[teammateId]` | `pages/api/commitments/[teammateId].ts` | 10s (default) | NEW | Pure DB — list open or resolved |
| `POST /api/commitments/[teammateId]` | `pages/api/commitments/[teammateId].ts` | 10s (default) | NEW | Pure DB — create commitment + duplicate check |
| `PATCH /api/commitments/[id]` | `pages/api/commitments/[id].ts` | 10s (default) | EXTENDED | + done/carried_forward/dropped actions (no timeout change) |
| `DELETE /api/commitments/[id]` | `pages/api/commitments/[id].ts` | 10s (default) | NEW | Pure DB — delete commitment |
| `GET /api/timeline/[teammateId]` | `pages/api/timeline/[teammateId].ts` | 10s (default) | NEW | Pure DB — all meetings for teammate |
| `POST /api/timeline/[teammateId]/summary` | `pages/api/timeline/[teammateId]/summary.ts` | 10s (default) | NEW | DB reads + Haiku call (≤5s p95) |

### No Timeout Overrides Required

No route in Unit 5 requires an extended `maxDuration`. The growth summary endpoint:
- DB reads (parallel): ~100ms
- Haiku call (max_tokens: 1500): ~3–4s p95
- Parse + response: ~50ms
- **Total p95: ~4–5s → fits default 10s**

All other Unit 5 routes are pure DB operations completing well under 1s.

---

## 2. Storage: Supabase PostgreSQL

### Tables Accessed by Unit 5 (No Schema Changes)

| Table | Unit 5 Operations |
|-------|------------------|
| `Commitment` | findMany (list open/resolved), create, update (status + carryCount), delete, findFirst (duplicate check) |
| `Meeting` | findMany (timeline list + growth summary), findFirst (ownership in summary) |
| `Teammate` | findFirst (ownership check in all routes) |
| `Manager` | None (auth resolved via `withAuth` session) |
| `Pattern` | None (read in Unit 4 SSR — no changes in Unit 5) |

**Schema changes**: None. All columns (`status`, `carryCount`, `dueDate`, `owner`) and enum values (`OPEN`, `CARRIED_FORWARD`, `DONE`, `DROPPED`, `SUGGESTED`) were defined in Unit 1.

### Query Characteristics

| Query | Estimated Latency | Notes |
|-------|------------------|-------|
| `commitment.findMany` (open list) | < 50ms | Single manager+teammate+status filter, small result set |
| `commitment.create` + `findFirst` (dup check) | < 80ms | Sequential; text icontains requires case-insensitive index |
| `commitment.update` (status change) | < 30ms | Single row update by id |
| `meeting.findMany` (timeline) | < 100ms | All statuses, ordered DESC, no join |
| `Promise.all([teammate, meetings])` (summary) | ~100ms | Parallel — P-5.01 |

---

## 3. External APIs: Anthropic Claude

### Growth Summary — Haiku

| Property | Value |
|----------|-------|
| Model | `claude-haiku-4-5-20251001` |
| Endpoint | `ANTHROPIC_API_KEY` (configured Unit 2) |
| max_tokens | 1500 |
| Calls per user action | 1 (on "Generate Growth Summary" click) |
| Retry policy | `callClaudeWithRetry` — 1 retry, 1s delay on transient 5xx/529/429 |
| Failure handling | Returns `null` → caller emits `{ summary: null }` → 200 (P-5.02) |

---

## 4. Environment Variables

**No changes.** Unit 5 uses all 13 existing environment variables unchanged:

| Variable | Source | Unit 5 Usage |
|----------|--------|-------------|
| `DATABASE_URL` | Unit 1 | All Prisma commitment + timeline queries |
| `DIRECT_URL` | Unit 1 | Prisma (no migrations in Unit 5) |
| `SECRET_KEY` | Unit 1 | `withAuth` session validation |
| `ANTHROPIC_API_KEY` | Unit 2 | Growth summary Haiku call |
| All others (9) | Units 1–3 | Unchanged — not used by Unit 5 routes |

---

## 5. Vercel Configuration

**No changes.** The existing `vercel.json` / `next.config.js` (if any) requires no modifications for Unit 5.

No cron job changes — Unit 5 adds no background processing. All operations are request-driven.

---

## 6. Security Considerations

All Unit 5 routes follow the established security model:

- **Auth**: All routes wrapped in `withAuth` HOC — unauthenticated requests return 401
- **Tenant isolation**: Every DB query scoped to `managerId` from session (never from request body/params)
- **Ownership checks**: Teammate ownership verified before any commitment or timeline operation
- **Input validation**: `text` and `owner` validated before `createCommitment`; `action` validated before dispatch
- **No new attack surface**: No new external integrations; Haiku call uses server-side API key only

Extension: Security Baseline — **Disabled** (configured at Requirements Analysis).
