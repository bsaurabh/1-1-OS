# Tech Stack Decisions — Unit 5: Tracker & Timeline

**Date**: 2026-03-02
**Unit**: Unit 5: Tracker & Timeline

---

## New Dependencies

### Runtime Dependencies: None

Unit 5 introduces **zero new npm packages**. All required libraries are already installed:

| Library | Installed In | Usage in Unit 5 |
|---------|-------------|-----------------|
| `@anthropic-ai/sdk` | Unit 2 | GrowthTimeline.generateGrowthSummary |
| `@prisma/client` | Unit 1 | Commitment CRUD + Timeline meeting reads |
| `next` | Unit 1 | New pages (timeline.tsx, commitments.tsx), extended API routes |
| `react` | Unit 1 | New components (CommitmentCard, TimelineList, etc.) |
| `tailwindcss` | Unit 1 | Component styling |

**Install command**: None required.

---

## New Environment Variables: None

Unit 5 introduces **zero new environment variables**:

| Variable | Configured In | Usage in Unit 5 |
|----------|-------------|-----------------|
| `ANTHROPIC_API_KEY` | Unit 2 | Growth summary Haiku call |
| `DATABASE_URL` | Unit 1 | All Prisma commitment + timeline queries |
| `DIRECT_URL` | Unit 1 | Prisma migrations (no new migrations in Unit 5) |

**Total**: 13 environment variables (unchanged from end of Unit 4).

---

## Vercel Configuration Changes: None

### Route Timeouts

| Route | maxDuration | Reason |
|-------|-------------|--------|
| `POST /api/timeline/[teammateId]/summary` | 10s (default) | Haiku call expected ≤ 5s p95; default timeout sufficient |
| All other Unit 5 routes | 10s (default) | Pure DB operations; no AI calls |

No `export const config = { api: { maxDuration: ... } }` overrides needed in Unit 5.

---

## Claude Model Decisions

| Handler | Model | Rationale |
|---------|-------|-----------|
| `generateGrowthSummary` (in lib/timeline.ts) | `claude-haiku-4-5-20251001` | Growth summary is a synthesis task from bounded inputs (≤10 meeting summaries); Haiku sufficient quality at lower cost and latency; 4–5s target fits default 10s timeout |

**Token budget**:
- Growth summary: `max_tokens: 1500` (JSON object: narrative paragraph + 3 short arrays)

---

## Architecture Decisions

### Decision 1: Tag filter is client-side (no API round-trip)

**Choice**: Timeline fetch returns all meetings; tag filtering is applied in-browser via `activeTag` state.

**Rationale**: The number of meetings per teammate is small (< 100 in MVP). Fetching all and filtering in the browser avoids a round-trip on every filter change, giving instant filter response. The full meeting list is < 50KB even at scale.

**Trade-off**: Adding a new meeting requires a page refresh to update available tag chips. Acceptable in MVP (TD-18).

---

### Decision 2: Extend PATCH /api/commitments/[id] rather than create a new route

**Choice**: Add `done`, `carried_forward`, `dropped` as new action values in the existing PATCH handler.

**Rationale**: The route already has a dispatch pattern on `action`. Extending it keeps commitment mutation in one place, avoids route proliferation, and is consistent with how `confirm` and `dismiss` are already handled.

**Trade-off**: Single route handles 5 actions. The handler is slightly larger but remains clear via the action dispatch pattern.

---

### Decision 3: lib/timeline.ts as a new lib file (not a handler)

**Choice**: Timeline functions live in `lib/timeline.ts`, not in `handlers/`.

**Rationale**: The `handlers/` directory is reserved for Claude API interactions (interviewAIHandler, meetingAnalysisHandler, patternDetectionHandler, etc.). The `lib/` directory holds business logic and data access. `generateGrowthSummary` calls Claude but it's more analogous to a lib function because it's called directly from the API route with no queueing or chaining. Following the pattern set by `lib/commitments.ts`.

**Trade-off**: Minor inconsistency — `lib/timeline.ts` contains a Claude call unlike most lib files. Mitigated by injectable client pattern for testing.

---

### Decision 4: Broken pattern signal at read time, not as Pattern row

**Choice**: Commitments with carryCount ≥ 2 are surfaced as broken pattern signals by reading from the commitments table, not by writing to the patterns table.

**Rationale**: The Pattern table is managed exclusively by PatternDetectionHandler (AI-generated, deduped, capped). Mixing in manual/derived signals would complicate dedup and eviction logic. Commitment carry patterns are a specific, first-class concept that's better expressed directly from commitment data.

**Trade-off**: The Patterns section on the teammate profile now has two data sources (Pattern rows + derived commitment signals). The UI separates them clearly.

---

### Decision 5: No new DB migration

**Choice**: Zero schema changes in Unit 5.

**Rationale**: The full schema (including Commitment with all status values and carryCount) was defined in Unit 1. All status transitions and carryCount increments operate on existing columns and enum values.

---

## Updated `.env.local` Template (No Changes)

```env
# Unit 1 — unchanged
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SECRET_KEY=local-dev-secret...
RESEND_API_KEY=re_placeholder
CRON_SECRET=local-cron-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Unit 2 — unchanged
ANTHROPIC_API_KEY=sk-ant-...

# Unit 3 — unchanged
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BExa...
VAPID_PRIVATE_KEY=Exa...
VAPID_SUBJECT=mailto:admin@example.com
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Unit 4 — no new variables
# Unit 5 — no new variables
```

**Total**: 13 environment variables (unchanged).

---

## Decision Log

| # | Decision | Alternative Considered | Why Chosen |
|---|----------|----------------------|------------|
| 1 | Client-side tag filter | Server-side filter via query param | Instant UX; meeting count small enough for in-browser filter |
| 2 | Extend PATCH /api/commitments/[id] | Separate routes for done/carry/drop | Action dispatch pattern already exists; less route proliferation |
| 3 | lib/timeline.ts (not handlers/) | handlers/timelineHandler.ts | Consistent with lib/commitments.ts; direct API call (not queued/chained) |
| 4 | Broken pattern at read time | Write Pattern row on carry forward | Keeps Pattern table clean (AI-generated only); simpler data model |
| 5 | No schema migration | Add new tables/columns | Full schema already defined in Unit 1 |
| 6 | Haiku for growth summary | Sonnet | Synthesis of bounded inputs; Haiku quality sufficient; fits 10s default timeout |
