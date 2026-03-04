# Infrastructure Design — Unit 4: Intelligence Engine

**Date**: 2026-03-02
**Unit**: Unit 4: Intelligence Engine
**Stories**: US-09, US-10, US-11, US-12, US-13, US-14

---

## Infrastructure Overview

Unit 4 is the **lowest-infrastructure-impact unit** in the project. It introduces zero new external services, zero new environment variables, and zero new npm packages. All new functionality runs on the existing Vercel + Supabase PostgreSQL + Anthropic Claude API stack.

The only infrastructure change is one new API route with an extended timeout (`maxDuration: 30`) and one new page (brief shell — standard SSR). The existing cron is extended internally with pattern detection logic.

```
Developer / Browser
      |
      v
  Vercel Edge Network (CDN + routing)
      |
      |-- Static assets (.next/static/) ──────────────────────── Vercel CDN
      |
      |-- SSR page requests (/teammates/[id]/brief)      [NEW Unit 4 — shell only]
      |       --> Vercel Serverless Function (Next.js SSR, 10s)
      |               --> Supabase PostgreSQL (ownership check only)
      |
      |-- SSR page requests (/teammates/[id])            [MODIFIED Unit 4]
      |       --> Vercel Serverless Function (Next.js SSR, 10s)
      |               --> Supabase PostgreSQL (+ patterns + meetingCount reads)
      |
      |-- API: POST /api/brief/[teammateId]/generate     [NEW Unit 4 — 30s]
      |       --> Vercel Serverless Function (30s maxDuration)
      |               --> Supabase PostgreSQL (4 parallel reads)
      |               --> Anthropic Claude API (Haiku: framework selection)
      |               --> Anthropic Claude API (Sonnet: brief generation)
      |
      |-- Vercel Cron (every ~1 min)                     [MODIFIED Unit 4]
              --> GET /api/jobs/process-analysis (60s max)
                      --> [all Unit 3 behaviour unchanged]
                      --> detectPatterns()               [NEW Unit 4 — chained]
                              --> Supabase PostgreSQL (meeting reads + pattern writes)
                              --> Anthropic Claude API (Haiku: pattern detection)
```

---

## 1. Compute: Vercel Serverless Functions

### New and Modified Route-to-Function Mapping (Unit 4)

| Route | Function File | Max Duration | Change | Notes |
|-------|--------------|-------------|--------|-------|
| `POST /api/brief/[teammateId]/generate` | `pages/api/brief/[teammateId]/generate.ts` | **30s** | NEW | Brief generation: parallel DB reads + 2 Claude calls |
| `GET /teammates/[id]/brief` | `pages/teammates/[id]/brief.tsx` | 10s (SSR) | NEW | Shell only — ownership check; brief fetched client-side |
| `GET /teammates/[id]` (SSR) | `pages/teammates/[id]/index.tsx` | 10s (SSR) | MODIFIED | + patterns + meetingCount SSR reads |
| `GET /api/jobs/process-analysis` | `pages/api/jobs/process-analysis.ts` | 60s | MODIFIED | + detectPatterns() chained after onComplete() |

### Extended Timeout Configuration (New Route)

```typescript
// pages/api/brief/[teammateId]/generate.ts
export const config = {
  api: {
    maxDuration: 30,  // Brief generation: DB reads (~200ms) + Haiku (~3s) + Sonnet (~7s) = ~10s p95
                      // 30s provides margin for Sonnet variability; 60s is unnecessary
  },
}
```

**No changes to existing route configurations.** The cron route remains at 60s (Unit 3). All other routes remain at the default 10s.

### Cron Handler Extension (Internal — No Config Change)

The existing `GET /api/jobs/process-analysis` cron handler is modified internally. `onComplete()` now chains `detectPatterns()`:

```typescript
// handlers/meetingAnalysisHandler.ts — onComplete() MODIFIED
async function onComplete(meetingId, managerId, teammateId, result) {
  // Unit 3 behaviour (unchanged)
  await prisma.meeting.update({ status: 'ANALYSIS_COMPLETE', ...result })
  await saveSuggested(...)
  await prisma.analysisJob.update({ status: 'COMPLETE' })

  // Unit 4 addition — isolated side-effect (P-4.01)
  try {
    await detectPatterns(teammateId, managerId)   // NEW
  } catch (err) {
    console.error('[patternDetection] failed', err)  // swallowed
  }
}
```

**Timing budget within the 60s cron window**:
- Existing meeting analysis (Unit 3): ~15–30s
- detectPatterns — early return if < 2 meetings: < 10ms
- detectPatterns — Haiku call (if ≥ 2 meetings): ~8s p95
- detectPatterns — pattern upsert(s): ~50ms
- **Total with pattern detection**: ~23–38s — well within 60s budget

**No vercel.json changes required.**

---

## 2. External Service: Anthropic Claude API (Extended Usage)

**Service**: Anthropic Claude API (`api.anthropic.com`)
**Already present from Unit 2** — extended with two new use cases in Unit 4.

### Additional Endpoint Usage (Unit 4)

| Handler | Endpoint | Model | Max Tokens | Called From | Est. Latency |
|---------|----------|-------|------------|-------------|-------------|
| `PatternDetectionHandler` | `POST /v1/messages` | `claude-haiku-4-5-20251001` | 1500 | Cron (chained from onComplete) | ~8s p95 |
| `CoachingStrategyHandler` | `POST /v1/messages` | `claude-haiku-4-5-20251001` | 500 | `/api/brief/generate` | ~3s p95 |
| `BriefGenerationHandler` | `POST /v1/messages` | `claude-sonnet-4-6` | 3000 | `/api/brief/generate` | ~7s p95 |

### Retry Behaviour (Unit 4)

All three new handlers use the `callClaudeWithRetry` pattern (1 inner retry, 1s delay) established in Unit 2:

```
callClaudeWithRetry(model, messages, max_tokens)
  attempt 1 → success → return content
  attempt 1 → fail (transient) → wait 1s → attempt 2
  attempt 2 → success → return content
  attempt 2 → fail → throw (caller handles)
```

- **PatternDetectionHandler failure**: swallowed by P-4.01 — pattern lags 1 cron cycle
- **CoachingStrategyHandler failure**: `fallbackApproach()` returns generic framework — brief continues
- **BriefGenerationHandler failure**: P-4.03 — `buildFallback()` returns DB-only fallback to client

### API Key (Unchanged)

| Variable | Exposure | Configured In |
|----------|---------|--------------|
| `ANTHROPIC_API_KEY` | Server-side only | Unit 2 (all environments) |

No changes to key management or storage.

---

## 3. Database: Supabase PostgreSQL

### Tables Used in Unit 4 (No New Tables, No Migrations)

| Table | Schema Source | Unit 4 Operations |
|-------|-------------|------------------|
| `patterns` | Unit 1 schema | SELECT (count, findMany, findFirst for eviction), INSERT, DELETE (eviction) |
| `meetings` | Unit 1 schema | SELECT (all ANALYSIS_COMPLETE for teammate — pattern detection) |
| `teammates` | Unit 1 schema | SELECT (ownership check for brief route + pattern page) |
| `commitments` | Unit 1 schema | SELECT (OPEN + CARRIED_FORWARD for brief) |

**No schema changes.** The `patterns` table was fully defined in Unit 1's schema:

```prisma
// Already in prisma/schema.prisma from Unit 1
model Pattern {
  id          String   @id @default(cuid())
  teammateId  String
  managerId   String
  description String
  severity    PatternSeverity  // INFORMATIONAL | WATCH | ACTION_REQUIRED
  tags        String[]
  evidence    String?
  detectedAt  DateTime @default(now())
  teammate    Teammate @relation(fields: [teammateId], references: [id])
  @@index([teammateId])
  @@map("patterns")
}
```

**No migration required.** `npx prisma migrate dev` is not needed for Unit 4.

### New Query Patterns

**Pattern count check** (before insert — P-4.05 cap enforcement):
```typescript
const count = await prisma.pattern.count({ where: { teammateId } })
// If count >= 10 → find and delete least severe/oldest before insert
```

**Severity-ordered eviction query**:
```typescript
// Eviction: INFORMATIONAL oldest first, then WATCH, never ACTION_REQUIRED unless only type
const toEvict = await prisma.pattern.findFirst({
  where: { teammateId },
  orderBy: [{ severity: 'asc' }, { detectedAt: 'asc' }],
})
```

**Parallel brief pre-fetch** (P-4.02 — all in one `Promise.all`):
```typescript
const [teammate, meetings, openCommitments, patterns] = await Promise.all([
  prisma.teammate.findFirst({ where: { id: teammateId, managerId } }),
  prisma.meeting.findMany({
    where: { teammateId, managerId, status: 'ANALYSIS_COMPLETE' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  }),
  prisma.commitment.findMany({
    where: { teammateId, managerId, status: { in: ['OPEN', 'CARRIED_FORWARD'] } },
  }),
  prisma.pattern.findMany({
    where: { teammateId },
    orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
  }),
])
```

### Connection Routing (Unchanged)

```
Vercel Function
  └─ Prisma Client
        ├─ DATABASE_URL (port 6543) ──── PgBouncer ──── PostgreSQL   (runtime queries)
        └─ DIRECT_URL   (port 5432) ───────────────────  PostgreSQL  (migrations only)
```

---

## 4. Environment Variables (No Changes)

**Unit 4 introduces zero new environment variables.** All 13 variables from Units 1–3 remain unchanged.

| Variable | Unit | Usage in Unit 4 |
|----------|------|----------------|
| `DATABASE_URL` | Unit 1 | All 4 parallel DB reads in BriefGenerationHandler; pattern CRUD |
| `DIRECT_URL` | Unit 1 | Migration connections (no Unit 4 migrations) |
| `ANTHROPIC_API_KEY` | Unit 2 | PatternDetectionHandler, CoachingStrategyHandler, BriefGenerationHandler |
| All other 10 vars | Units 1–3 | Unchanged — not used by Unit 4 specifically |

**`.env.local` requires no updates for Unit 4.**

---

## 5. No New Infrastructure

The following were considered and **not** introduced in Unit 4:

| Service / Pattern | Decision | Reason |
|------------------|----------|--------|
| Redis / edge cache for briefs | Not introduced | Fresh data required; stale briefs miss new commitments; complexity unjustified at PoC |
| Separate cron for pattern detection | Not introduced | Chained inside existing cron is simpler; 60s cron budget accommodates the extra ~8s |
| Brief generation SSR (no client fetch) | Not used | SSR timeout risk at 10s p95; client-side fetch enables spinner UX (P-4.06) |
| Separate Claude client per handler | Not introduced | `callClaudeWithRetry` pattern reused; injectable client for tests |
| New npm packages | Not introduced | All required libs present from Units 1–3 |
| New external APIs | Not introduced | Anthropic API is the only external dependency for Unit 4 |

---

## 6. Security Boundary (Unit 4 Extensions)

No new security surfaces. Existing patterns apply:

```
Browser (Public)
  │  POST /api/brief/[teammateId]/generate
  │  (no body — teammateId from URL param)
  │
  ▼ HTTPS
Vercel Serverless (30s) — Trusted
  │  withAuth → managerId from JWT cookie (never from body/query)
  │  prisma.teammate.findFirst({ id: teammateId, managerId })
  │    └─ managerId mismatch → 404 (ownership enforced)
  │  BriefGenerationHandler.generateBrief(managerId, teammateId)
  │    └─ all 4 DB reads filtered by managerId (P-1.01)
  │    └─ ANTHROPIC_API_KEY from env only
  ▼
Supabase PostgreSQL + Anthropic Claude API
```

**Manager isolation**: All `prisma.pattern` reads in Unit 4 filter by `teammate.managerId` via the ownership check before any data access. A manager cannot retrieve another manager's patterns or brief.

---

## 7. Setup Checklists

### Local Development (Unit 4 — No New Setup Required)

Unit 4 requires **zero additional local setup steps**. All prerequisites are already in place after Unit 3:

- [x] `ANTHROPIC_API_KEY` set in `.env.local` (Unit 2)
- [x] `DATABASE_URL` and `DIRECT_URL` set in `.env.local` (Unit 1)
- [x] `patterns` table exists in Supabase PostgreSQL (Unit 1 schema)
- [x] All npm packages installed

**Verification** (confirm Unit 4 functionality):
- [ ] `npm run dev` starts successfully
- [ ] Navigate to `/teammates/[id]` — confirm Patterns section renders (may be empty initially)
- [ ] Navigate to `/teammates/[id]/brief` — confirm spinner appears immediately
- [ ] Trigger brief generation: confirm brief loads within ~10s (or fallback appears)
- [ ] Trigger cron manually: `curl http://localhost:3000/api/jobs/process-analysis -H "Authorization: Bearer local-cron-secret"` — confirm `detectPatterns()` runs after analysis completes (check server logs)

### Vercel Production (Unit 4 — No New Setup Required)

Unit 4 requires **zero additional Vercel configuration**. Existing setup from Units 1–3 is complete:

- [x] All 13 environment variables already set in Vercel dashboard
- [x] `patterns` table exists in production Supabase (Unit 1 migration)
- [x] Vercel cron (`process-analysis`) already running

**Deploy**:
```bash
git push  # Vercel CI/CD picks up automatically
```

**Post-deploy verification**:
- [ ] Confirm `/api/brief/[teammateId]/generate` returns 200 with brief data
- [ ] Confirm `/teammates/[id]` page loads with Patterns section
- [ ] After next cron tick + meeting analysis, confirm patterns appear on profile
- [ ] Test "Copy to Clipboard" on brief page — confirm plain-text format

---

## 8. Infrastructure Changes vs Unit 3

| Dimension | Unit 3 | Unit 4 Change |
|-----------|--------|---------------|
| New Vercel routes | 11 routes | +1 route (brief/generate — 30s) |
| New SSR pages | 1 new page | +1 page (brief shell — 10s) |
| Modified SSR pages | 1 (teammates index — Add Meeting) | +1 (teammates index — patterns + meetingCount) |
| Modified cron handler | Wired (Unit 3) | +detectPatterns() chain (internal only) |
| Function timeout max | 60s (transcribe + cron) | +30s (brief/generate) |
| External services | + OpenAI, Supabase Storage, web-push | **None** |
| Environment variables | 13 total | **No change** (13 total) |
| DB migrations | 1 (retryCount) | **None** |
| npm packages (runtime) | +6 (Unit 3) | **None** |
| npm packages (dev) | +2 (Unit 3) | **None** |

Unit 4 is intentionally **infrastructure-minimal** — all complexity is in the application logic (handlers, prompts, patterns).
