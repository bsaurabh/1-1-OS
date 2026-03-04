# Unit 4: Intelligence Engine — NFR Requirements Plan

**Unit**: Unit 4: Intelligence Engine
**Date**: 2026-03-02

---

## Checklist

- [x] Step 1: Analyze functional design artifacts
- [x] Step 2: Identify NFR categories applicable to Unit 4
- [x] Step 3: Answer all NFR questions from existing project context
- [x] Step 4: Generate nfr-requirements.md
- [x] Step 5: Generate tech-stack-decisions.md

---

## Questions & Answers

**Q1: What are the latency targets for brief generation (POST /api/brief/generate)?**
[Answer]: Target p95 ≤ 10s (per US-10: "within 10 seconds"). This drives the choice of Sonnet (not Opus) and the pattern of pre-fetching all DB data in parallel before calling Claude.

**Q2: What is the latency target for pattern detection (cron-chained)?**
[Answer]: Pattern detection runs inside the 60s cron budget after meeting analysis (~5s). Target: ≤ 10s for pattern Claude call (Claude Haiku for speed). Total cron budget is already documented: ~15s typical.

**Q3: What are the latency targets for the coaching framework selection?**
[Answer]: CoachingStrategyHandler is called synchronously inside BriefGenerationHandler. Claude Haiku used; target ≤ 3s. Combined with brief Claude call (≤ 8s), total brief generation ≤ 10s p95 is achievable.

**Q4: Are there any new npm packages needed for Unit 4?**
[Answer]: No new runtime dependencies. Unit 4 uses:
- `@anthropic-ai/sdk` (already installed, Unit 2)
- `@prisma/client` (already installed, Unit 1)
- All Claude calls use the existing handler pattern from Unit 2
No new deps needed.

**Q5: Are there new environment variables needed?**
[Answer]: No new env vars. All Claude calls use the existing `ANTHROPIC_API_KEY`. Database uses existing `DATABASE_URL` / `DIRECT_URL`. No new external services introduced.

**Q6: What is the performance target for the pattern detection Claude call?**
[Answer]: Claude Haiku is used for pattern detection (speed optimized). Target: p95 ≤ 8s for the Haiku call. Pattern detection is non-blocking to analysis completion — failure is isolated.

**Q7: How should brief generation handle the 10s Vercel serverless timeout?**
[Answer]: `/api/brief/[teammateId]/generate` needs `maxDuration: 30` (not 60) — brief generation targets ≤ 10s but we give 30s headroom for Sonnet variability. This is a new timeout config needed.

**Q8: What is the caching strategy for brief data?**
[Answer]: No caching. Briefs are always generated fresh (BR-4.07). DB reads are fast (indexed queries). No Redis or edge caching needed at this stage.

**Q9: What are the reliability requirements for pattern detection?**
[Answer]: Pattern detection failure is isolated (BR-4.05) — does not fail meeting analysis. Error logged but swallowed. No retry for pattern detection (unlike meeting analysis which has 3 attempts). Acceptable: patterns may lag by 1 cron cycle if detection fails.

**Q10: Are there any new technical debt items introduced?**
[Answer]:
- TD-14: Brief generation latency is tied to Claude Sonnet performance — no client-side timeout implemented (browser waits up to 30s)
- TD-15: Pattern deduplication is approximate (tag overlap heuristic) — may produce near-duplicate patterns if descriptions vary significantly with same underlying tags
- TD-16: `formatBriefAsText` plain-text copy format is basic — no Markdown or rich formatting for clipboard output
