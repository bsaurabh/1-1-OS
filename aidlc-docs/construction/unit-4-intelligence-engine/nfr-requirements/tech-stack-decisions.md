# Tech Stack Decisions — Unit 4: Intelligence Engine

**Date**: 2026-03-02
**Unit**: Unit 4: Intelligence Engine

---

## New Dependencies

### Runtime Dependencies: None

Unit 4 introduces **zero new npm packages**. All required libraries are already installed:

| Library | Installed In | Usage in Unit 4 |
|---------|-------------|-----------------|
| `@anthropic-ai/sdk` | Unit 2 | PatternDetectionHandler, CoachingStrategyHandler, BriefGenerationHandler |
| `@prisma/client` | Unit 1 | Pattern reads/writes, Meeting/Commitment/Teammate reads |
| `next` | Unit 1 | New pages (brief.tsx), modified pages (index.tsx) |
| `react` | Unit 1 | New components (PatternList, BriefView, etc.) |
| `tailwindcss` | Unit 1 | Component styling |

**Install command**: None required.

---

## New Environment Variables: None

Unit 4 introduces **zero new environment variables**. All required secrets are already configured:

| Variable | Configured In | Usage in Unit 4 |
|----------|-------------|-----------------|
| `ANTHROPIC_API_KEY` | Unit 2 | All three Claude API calls |
| `DATABASE_URL` | Unit 1 | Prisma pattern + meeting + commitment queries |
| `DIRECT_URL` | Unit 1 | Prisma direct connection for migrations |

---

## Vercel Configuration Changes

### New Route Timeouts

| Route | maxDuration | Reason |
|-------|-------------|--------|
| `POST /api/brief/[teammateId]/generate` | 30s | Brief generation targets ≤ 10s p95; 30s gives headroom for Sonnet variability |

**All other Unit 4 routes**: Default 10s (Vercel serverless standard).

**No vercel.json changes needed** — `maxDuration` set via `export const config = { api: { maxDuration: 30 } }` in the route file.

---

## Claude Model Decisions

| Handler | Model | Rationale |
|---------|-------|-----------|
| `PatternDetectionHandler` | `claude-haiku-4-5-20251001` | Speed-optimized; runs inside 60s cron budget; structured JSON output; pattern detection doesn't require Sonnet-level reasoning |
| `CoachingStrategyHandler` | `claude-haiku-4-5-20251001` | Selects from a known framework list; short output; called inline during brief generation (minimizes latency) |
| `BriefGenerationHandler` | `claude-sonnet-4-6` | Full brief requires nuanced synthesis of profile + meeting history + patterns; higher quality output justifies Sonnet |

**Token budgets**:
- Pattern detection: `max_tokens: 1500` (JSON array of 2–5 patterns)
- Framework selection: `max_tokens: 500` (JSON object with framework + rationale + actions)
- Brief generation: `max_tokens: 3000` (JSON object with 5 fields including 5–7 questions)

---

## Architecture Decisions

### Decision 1: Brief generation is client-side triggered, not SSR

**Choice**: Brief page SSR only verifies ownership. Brief is fetched via `useEffect` on client mount (POST to API route).

**Rationale**: Brief generation can take up to 10s. SSR has a practical timeout of ~10s on Vercel (actual limit is configurable but default is fast). Generating on the client avoids SSR timeout risk, allows showing a spinner immediately, and enables retry without full page reload.

**Trade-off**: First Contentful Paint shows spinner (acceptable for a "prepare" workflow — manager intentionally waits for brief).

---

### Decision 2: Claude Haiku for CoachingStrategyHandler

**Choice**: Use `claude-haiku-4-5-20251001` for framework selection rather than Sonnet.

**Rationale**: Framework selection is a classification task from a known 6-item list. The prompt includes explicit selection rules. Haiku produces accurate results for this constrained task at ~3s vs. ~6–7s for Sonnet. The time saved is critical for the 10s brief budget.

---

### Decision 3: Pattern detection chained inside cron (not separate endpoint)

**Choice**: `detectPatterns()` is called at the end of `MeetingAnalysisHandler.onComplete()` inside the cron function, not exposed as a separate API route.

**Rationale**: Pattern detection is a side effect of meeting analysis completion. Chaining avoids a second cron trigger, keeps the pattern data fresh after every analysis, and avoids an extra Vercel function call. The 60s cron budget easily accommodates the additional ~8s.

**Trade-off**: Longer cron execution time per tick when patterns are needed. Mitigated by early-return when `meetings.length < 2`.

---

### Decision 4: No caching for brief data

**Choice**: Each brief generation call fetches fresh data from DB.

**Rationale**: Briefs must reflect the current state of commitments, patterns, and meetings. Stale briefs could cause managers to miss new commitments or cleared patterns. At current scale (single-manager app), DB reads are fast (< 200ms).

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
```

**Total**: 13 environment variables (unchanged from end of Unit 3).

---

## Decision Log

| # | Decision | Alternative Considered | Why Chosen |
|---|----------|----------------------|------------|
| 1 | Client-side brief fetch | SSR brief generation | Avoids SSR timeout; enables spinner UX |
| 2 | Haiku for framework selection | Sonnet for everything | Saves ~4s; framework selection is a classification task |
| 3 | Pattern detection chained in cron | Separate cron trigger | Simpler; keeps data fresh; within 60s budget |
| 4 | No brief caching | Redis/edge cache | Fresh data required; added complexity unjustified at current scale |
| 5 | No new dependencies | (N/A) | All required libs already installed in prior units |
| 6 | `maxDuration: 30` for brief route | 10s (default) or 60s | 10s too tight for p95 brief; 60s unnecessary; 30s gives safe margin |
