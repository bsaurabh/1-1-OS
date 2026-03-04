# Deployment Architecture — Unit 5: Tracker & Timeline

**Date**: 2026-03-02
**Unit**: Unit 5: Tracker & Timeline

---

## Deployment Architecture Overview

Unit 5 deploys entirely within the existing production topology. No new infrastructure provisioning is required. The addition of new routes and pages is handled automatically by Vercel's Next.js build process.

---

## Production Topology (Unchanged)

```
                         INTERNET
                            |
                    [Vercel Edge Network]
                    (CDN + TLS termination)
                            |
              +-------------+-------------+
              |                           |
    [Static Assets]              [Serverless Functions]
    (Vercel CDN)                 (Next.js API Routes)
    .next/static/                        |
                              +----------+----------+
                              |                     |
                    [SSR Page Functions]    [API Route Functions]
                    10s default timeout     10s default timeout
                              |                     |
                    +---------+---------+   +-------+-------+
                    |                   |   |               |
             [Supabase PostgreSQL]   [Anthropic Claude API]
             (connection pooling     (ANTHROPIC_API_KEY)
              via DATABASE_URL)
```

---

## Unit 5 Additions to Deployment Surface

### New Serverless Function Files

```
pages/
├── teammates/
│   └── [id]/
│       ├── commitments.tsx       [NEW — SSR shell]
│       └── timeline.tsx          [NEW — SSR shell]
└── api/
    ├── commitments/
    │   ├── [teammateId].ts       [NEW — GET + POST]
    │   └── [id].ts               [EXTENDED — +done/carry/drop/DELETE]
    └── timeline/
        └── [teammateId]/
            ├── index.ts          [NEW — GET meetings]
            └── summary.ts        [NEW — POST growth summary]
```

All files deploy as individual Vercel Serverless Functions scoped to the same Vercel project. No deployment configuration changes required.

---

## Environment Configuration (No Changes)

| Environment | DATABASE_URL | ANTHROPIC_API_KEY | Notes |
|-------------|-------------|-------------------|-------|
| Production | Supabase prod pool | Anthropic prod key | Existing — no change |
| Preview | Supabase staging pool | Anthropic key (shared) | Existing — no change |
| Local | Local PostgreSQL | Anthropic key | `.env.local` — no change |

---

## Route Availability After Deployment

| Route | Availability | Auth |
|-------|-------------|------|
| `GET /teammates/[id]/commitments` | Immediate on deploy | withAuth |
| `GET /teammates/[id]/timeline` | Immediate on deploy | withAuth |
| `GET /api/commitments/[teammateId]` | Immediate on deploy | withAuth |
| `POST /api/commitments/[teammateId]` | Immediate on deploy | withAuth |
| `PATCH /api/commitments/[id]` | Existing route extended | withAuth |
| `DELETE /api/commitments/[id]` | Immediate on deploy | withAuth |
| `GET /api/timeline/[teammateId]` | Immediate on deploy | withAuth |
| `POST /api/timeline/[teammateId]/summary` | Immediate on deploy | withAuth |

---

## Deployment Steps (No Infrastructure Provisioning Required)

```
1. git push → Vercel CI triggered
2. Next.js build compiles new pages + API routes
3. Vercel deploys updated serverless function bundle
4. New routes available immediately (zero-downtime deployment)
5. No DB migration required (schema unchanged from Unit 1)
6. No environment variable updates required
7. No cron or webhook configuration changes required
```

---

## Rollback Plan

Standard Vercel rollback to prior deployment (instant via dashboard or `vercel rollback`). No DB migration to reverse — schema is unchanged. Existing PATCH `/api/commitments/[id]` handler remains compatible if rolled back (Unit 3 actions unaffected).

---

## Monitoring (Existing Tooling — No Changes)

| Signal | Source | Notes |
|--------|--------|-------|
| Function invocations | Vercel Dashboard | All new routes tracked automatically |
| Function errors | Vercel Dashboard | 5xx surfaced in runtime logs |
| Claude latency | `console.log` in `generateGrowthSummary` | Existing pattern |
| DB query performance | Supabase Dashboard | Slow query log ≥ 500ms |
| Growth summary failures | `console.error('[growthSummary] generation failed:', err)` | P-5.02 failure path |
