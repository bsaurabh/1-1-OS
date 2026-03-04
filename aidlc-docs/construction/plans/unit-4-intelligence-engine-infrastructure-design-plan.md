# Unit 4: Intelligence Engine — Infrastructure Design Plan

**Unit**: Unit 4: Intelligence Engine
**Date**: 2026-03-02

---

## Checklist

- [x] Step 1: Analyze functional + NFR design artifacts for Unit 4
- [x] Step 2: Identify infrastructure impact (new routes, services, DB, env vars)
- [x] Step 3: Answer all infrastructure questions from context
- [x] Step 4: Generate infrastructure-design.md
- [x] Step 5: Generate deployment-architecture.md

---

## Questions & Answers

**Q1: Are any new external services required?**
[Answer]: No. Unit 4 uses only the Anthropic Claude API (already present from Unit 2). Zero new external services.

**Q2: Are any new environment variables required?**
[Answer]: No. All 13 existing env vars are sufficient. ANTHROPIC_API_KEY (Unit 2), DATABASE_URL (Unit 1), DIRECT_URL (Unit 1) cover all Unit 4 needs.

**Q3: Are any new npm packages required?**
[Answer]: No. @anthropic-ai/sdk, @prisma/client, next, react, tailwindcss are all already installed.

**Q4: What new Vercel routes are added?**
[Answer]: One new route: POST /api/brief/[teammateId]/generate with maxDuration: 30 (set via export const config). Plus one new SSR page: pages/teammates/[id]/brief.tsx (default 10s SSR).

**Q5: Does the cron configuration change?**
[Answer]: No new cron. The existing cron (GET /api/jobs/process-analysis, every 1 min) is extended internally — onComplete() now chains detectPatterns(). No vercel.json changes needed.

**Q6: Are any DB schema changes or migrations required?**
[Answer]: No. The `patterns` table was defined in the Unit 1 schema. Unit 4 only reads/writes to existing tables (patterns, meetings, teammates, commitments). No migration needed.

**Q7: What is the database access pattern for the new patterns table?**
[Answer]: Pattern reads: prisma.pattern.findMany (indexed on teammateId). Pattern count: prisma.pattern.count. Pattern create/delete: standard CRUD. All queries filtered by managerId via teammate ownership check (P-1.01 pattern).
