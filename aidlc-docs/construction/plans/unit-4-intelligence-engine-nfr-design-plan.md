# Unit 4: Intelligence Engine — NFR Design Plan

**Unit**: Unit 4: Intelligence Engine
**Date**: 2026-03-02

---

## Checklist

- [x] Step 1: Analyze NFR requirements (nfr-requirements.md + tech-stack-decisions.md)
- [x] Step 2: Identify applicable design patterns
- [x] Step 3: Answer all pattern and component questions from context
- [x] Step 4: Generate nfr-design-patterns.md
- [x] Step 5: Generate logical-components.md

---

## Questions & Answers

**Q1: What resilience pattern covers brief generation failure?**
[Answer]: P-4.03 Graceful Degradation with Structured Fallback — BriefGenerationHandler wraps the full generation pipeline in try/catch and always returns `{ brief, fallback }`. The fallback is built from raw DB data (no Claude) so it's always available regardless of AI failures.

**Q2: What pattern covers pattern detection failure isolation from the cron?**
[Answer]: P-4.01 Chained Side-Effect with Failure Isolation — PatternDetectionHandler is called after `onComplete()` in the cron. Its try/catch is separate from the meeting analysis try/catch. A pattern detection error does not affect `ANALYSIS_COMPLETE` status.

**Q3: What performance pattern ensures the 10s brief budget is met?**
[Answer]: P-4.02 Parallel DB Pre-fetch — All four DB reads (teammate, meetings, commitments, patterns) run in `Promise.all()` before any Claude call. This reduces the DB portion from ~800ms sequential to ~200ms parallel.

**Q4: What pattern governs the two-Claude-model strategy (Haiku + Sonnet)?**
[Answer]: P-4.04 Tiered Claude Model Selection — Haiku for classification tasks (CoachingStrategyHandler: pick framework from 6 options), Sonnet for synthesis tasks (BriefGenerationHandler: synthesize context into full brief). Model choice is a compile-time constant per handler, not runtime configurable.

**Q5: What pattern handles the manager isolation requirement across all Unit 4 routes?**
[Answer]: Inherited P-1.01 Manager-Scoped Queries (from Unit 1 — applies to all units). Unit 4 uses the same `withAuth` HOC + `managerId` in every Prisma WHERE clause. No new pattern needed; documented as applying to new components.

**Q6: What pattern covers the pattern cap (max 10 per teammate)?**
[Answer]: P-4.05 Bounded Collection with Severity-Weighted Eviction — Before creating a new Pattern, count existing patterns. If count ≥ 10, delete the INFORMATIONAL pattern with the oldest `detectedAt` first, then WATCH, then ACTION_REQUIRED (never evict ACTION_REQUIRED if count < 10 from INFORMATIONAL/WATCH).

**Q7: How does the brief page handle the async generation with loading state?**
[Answer]: P-4.06 Client-Side Async Fetch with Immediate Shell — Page SSR renders the shell (AppLayout + header + spinner). On mount, `useEffect` fires the POST call. This separates layout rendering from data fetching and avoids SSR timeout risk.

**Q8: What pattern handles the clipboard copy (US-11)?**
[Answer]: P-4.07 Plain-Text Brief Serialization — `formatBriefAsText()` is a pure function that converts the `Brief` object to a structured plain-text string (no HTML, no Markdown). Uses section headers and numbered lists for readability. Called client-side only.
