# Unit of Work Dependencies — 1:1OS

**Date**: 2026-03-01
**Build strategy**: Strictly sequential

---

## Dependency Matrix

| Unit | Depends On | Reason |
|------|------------|--------|
| Unit 1: Foundation | None | First unit — establishes all shared infrastructure |
| Unit 2: Teammate Profiles | Unit 1 | Requires DB schema, auth middleware, DatabaseService, and Claude API integration pattern |
| Unit 3: Meeting Ingestion | Unit 2 | Requires teammate records to exist; reuses Claude integration; analysis uses teammate profile context |
| Unit 4: Intelligence Engine | Unit 3 | Requires analyzed meetings with themes/tags; PatternDetectionHandler is chained from MeetingAnalysisHandler |
| Unit 5: Tracker & Timeline | Unit 4 | Requires patterns (brief surfaces broken commitments); commitment data fully populated by Unit 3; timeline requires tagged meetings |

---

## Build Sequence

```
Unit 1: Foundation
    |
    | provides: DB schema, auth, session middleware, Supabase, Prisma, Vercel cron scaffold
    v
Unit 2: Teammate Profiles
    |
    | provides: teammate records, profile data, AI interview pattern (Claude proven)
    v
Unit 3: Meeting Ingestion
    |
    | provides: meetings with themes/tags, suggested commitments, async analysis pipeline, notifications
    v
Unit 4: Intelligence Engine
    |
    | provides: patterns with severity, pre-meeting briefs, coaching strategy recommendations
    v
Unit 5: Tracker & Timeline
    |
    v
  COMPLETE — ready for Build and Test
```

---

## Cross-Unit Interface Contracts

These are the data contracts that one unit produces and the next unit consumes. Breaking changes to these interfaces block downstream units.

| Producer Unit | Consumer Unit | Contract |
|---------------|---------------|---------|
| Unit 1 | Unit 2+ | `managerId` in session JWT; Prisma `Manager`, `Teammate`, `Meeting`, `Pattern`, `Commitment`, `AnalysisJob` models with full schema |
| Unit 1 | Unit 2+ | `withAuth(handler)` middleware signature |
| Unit 2 | Unit 3 | `Teammate.profile` fields populated (used by MeetingAnalysisHandler as Claude context) |
| Unit 3 | Unit 4 | `Meeting.themes`, `Meeting.tags`, `Meeting.summary` fields populated; `Pattern` records written by PatternDetectionHandler |
| Unit 3 | Unit 5 | `Commitment` records in status `suggested` or `open` |
| Unit 4 | Unit 5 | `Pattern` records include broken-commitment signals; `Brief` includes open commitments |

---

## Risk Points

| Risk | Affected Units | Mitigation |
|------|---------------|------------|
| Prisma schema change after Unit 1 | All downstream units | Define full schema in Unit 1; avoid migrations mid-sequence |
| Claude API latency / rate limits | Units 2, 3, 4, 5 | Mock Claude responses in unit tests; use real API only in integration tests |
| Vercel cron not firing in dev | Unit 3 | Add a manual trigger endpoint `POST /api/jobs/trigger` for local development |
| Supabase Storage permissions | Unit 3 | Configure bucket policies in Unit 1 setup; verify in Unit 3 integration test |
