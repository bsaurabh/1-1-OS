# NFR Requirements — Unit 4: Intelligence Engine

**Date**: 2026-03-02
**Unit**: Unit 4: Intelligence Engine

---

## Performance

| Requirement | Target | Enforcement |
|-------------|--------|-------------|
| Pre-Meeting Brief generation (p95) | ≤ 10s | Claude Sonnet call + parallel DB reads; Vercel `maxDuration: 30` |
| Coaching framework selection (p95) | ≤ 3s | Claude Haiku used for CoachingStrategyHandler |
| Pattern detection Claude call (p95) | ≤ 8s | Claude Haiku used; runs inside 60s cron budget |
| Patterns section load on profile page | ≤ 1s | SSR — Prisma indexed read on (teammateId) |
| Brief page initial load (spinner visible immediately) | < 200ms | SSR renders shell + spinner; brief fetched client-side |

**Brief Generation Budget** (total ≤ 10s target):
- DB reads in parallel (teammate + meetings + commitments + patterns): ~200ms
- CoachingStrategyHandler (Claude Haiku): ~3s
- BriefGenerationHandler (Claude Sonnet, max_tokens: 3000): ~6–7s
- Response assembly + parse: ~50ms
- Total p50: ~7s | p95: ~10s

---

## Reliability

| Requirement | Specification |
|-------------|---------------|
| Pattern detection failure isolation | Errors caught and logged; does NOT fail meeting analysis (BR-4.05) |
| Pattern detection retry | None — may lag 1 cron cycle; acceptable |
| Brief generation fallback | Always returns fallback on failure — no blank page (BR-4.09) |
| Brief CoachingStrategy fallback | Returns generic approach; does not fail brief (BR-4.14) |
| Claude retry (brief generation) | 1 inner retry for transient 5xx/429 errors (same `callClaudeWithRetry` pattern as Unit 2/3) |
| Pattern detection Claude retry | 1 inner retry (same pattern) |

---

## Security

| Requirement | Specification |
|-------------|---------------|
| Manager isolation — patterns | All `prisma.pattern` reads filtered by `managerId` via teammate ownership check |
| Manager isolation — brief | `POST /api/brief/[teammateId]/generate` verifies teammate belongs to authenticated manager before generating |
| API authentication | `withAuth` HOC on all new routes (existing pattern) |
| No new env vars | No additional secrets required |
| Claude prompt injection | Meeting rawText included in prompts — existing risk (same as Unit 3); no new attack surface |

---

## Scalability

| Requirement | Specification |
|-------------|---------------|
| Pattern count cap | Max 10 Pattern rows per teammate (BR-4.20); prevents unbounded table growth |
| Meeting history size | Brief uses last 10 meetings (truncated summaries); prompts stay within Claude token limits |
| Pattern detection input | All meeting summaries aggregated (not raw text); bounded by meeting count × 500 chars |
| Stateless brief generation | No brief state stored; scales horizontally via Vercel serverless |

---

## Availability

| Requirement | Specification |
|-------------|---------------|
| Brief endpoint uptime | Vercel serverless (same as all other routes); no special HA requirement |
| Pattern detection availability | Chained inside cron; if cron misses, patterns lag but recover on next tick |
| No new infrastructure | Unit 4 adds no new external services — purely Anthropic Claude API calls |

---

## Maintainability

| Requirement | Specification |
|-------------|---------------|
| Handler pattern consistency | PatternDetectionHandler + BriefGenerationHandler + CoachingStrategyHandler follow same pattern as Unit 2/3 handlers (injectable client for tests) |
| VALID_SEVERITIES constant | Defined in PatternDetectionHandler; filter applied before DB write |
| VALID_FRAMEWORKS constant | Defined in CoachingStrategyHandler; filter applied before returning approach |
| Test coverage | Unit tests for all 3 handlers + API route + SSR page prop loading |

---

## Usability

| Requirement | Specification |
|-------------|---------------|
| Brief load feedback | Spinner shown immediately on brief page mount; user never sees blank page |
| Copy confirmation | Toast "Brief copied." shown for 3s after clipboard write (US-11) |
| Empty history state | Clear message with CTA to add a meeting (US-10 acceptance criteria) |
| Pattern empty states | Two distinct states: < 2 meetings vs. 2+ meetings but no patterns yet (BR-4.01) |
| Brief fallback visibility | Fallback section clearly labeled; "Try Again" button always visible |

---

## Technical Debt

| ID | Item | Impact |
|----|------|--------|
| TD-14 | No client-side timeout on brief fetch | User waits up to 30s if Sonnet is slow; no abort/timeout signal |
| TD-15 | Approximate pattern deduplication | Near-duplicate patterns possible if tag overlap < 2 but semantically identical |
| TD-16 | Plain-text brief clipboard format | No Markdown formatting; bullets and headers stripped |
