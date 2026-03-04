# Performance Test Instructions — 1:1OS

**Date**: 2026-03-03
**Scope**: Units 1–5 — auth, AI interview, meeting ingestion, intelligence engine, tracker & timeline

---

## Performance Requirements (from NFR-1)

| Endpoint | Target (p95) | Notes |
|----------|-------------|-------|
| `POST /api/auth/login` | < 500ms | bcrypt cost 12 ≈ 250ms; remainder is DB + JWT |
| `POST /api/auth/register` | < 500ms | Same profile as login |
| `POST /api/auth/forgot-password` | < 200ms | Returns immediately; email sent async |
| `POST /api/auth/reset-password` | < 500ms | DB lookup + bcrypt + DB update |
| `POST /api/interviews/[id]/next` | < 5,000ms | Haiku model; 1–3s typical; 30s max |
| `POST /api/interviews/[id]/complete` | < 20,000ms | Sonnet synthesis; 8–15s typical; 30s max |
| `GET /api/teammates` | < 200ms | Simple DB query, no AI |
| `PATCH /api/teammates/[id]` | < 200ms | DB write, no AI |
| `POST /api/meetings/[id]/paste` | < 300ms | Text validation + DB write + enqueue; no AI wait |
| `POST /api/meetings/[id]/upload` | < 2,000ms | In-memory file parse (mammoth/pdf-parse) + DB write |
| `GET /api/jobs/process-analysis` (cron) | < 30,000ms | Sonnet analysis; 8–15s typical; bounded by Vercel 60s max |
| `POST /api/brief/[id]/generate` | < 10,000ms | Haiku (framework) + Sonnet (brief) in sequence; 5–10s typical |
| `GET /api/timeline/[id]` | < 200ms | DB read only, no AI |
| `GET /api/commitments/[id]?status=` | < 200ms | DB read only, no AI |
| `PATCH /api/commitments/[id]` | < 200ms | DB write only, no AI |
| `POST /api/timeline/[id]/summary` | < 5,000ms | Haiku model; 1–3s typical |
| Page TTI (login, register, dashboard) | < 3,000ms | SSR pages |

---

## PoC Scale Targets

- **Concurrent users**: ≤ 20 (PoC — ~100 total managers)
- **Error rate**: < 1% under normal load
- **Cold start allowance**: Up to 500ms additional latency on first request

---

## Setup

Install a lightweight load testing tool:

```bash
npm install -g autocannon
# OR use k6 (https://k6.io) for more advanced scenarios
```

Ensure the application is running against the production Vercel deployment (or local dev server for baseline):

```bash
npm run dev
# or test against: https://<project>.vercel.app
```

---

## Test 1: Login Endpoint Baseline

```bash
# 10 concurrent connections, 10 seconds duration
autocannon -c 10 -d 10 -m POST \
  -H "Content-Type: application/json" \
  -b '{"email":"loadtest@example.com","password":"password123"}' \
  http://localhost:3000/api/auth/login
```

**Expected results**:
- Latency p95: < 500ms
- Latency p99: < 1000ms (cold start buffer)
- Requests/sec: > 5 (at bcrypt cost 12, ~4 rps is expected per CPU core)
- Errors: 0

**Interpreting bcrypt performance**: At cost factor 12, each bcrypt operation takes ~250ms. With 10 concurrent requests and a single-core serverless function, throughput is limited by bcrypt. This is expected and acceptable — the security benefit outweighs the throughput trade-off at PoC scale.

---

## Test 2: Register Endpoint Baseline

```bash
# Use unique emails to avoid 409 conflicts
autocannon -c 5 -d 5 -m POST \
  -H "Content-Type: application/json" \
  -b '{"email":"loadtest-{{i}}@example.com","password":"password123"}' \
  http://localhost:3000/api/auth/register
```

**Note**: Autocannon doesn't support dynamic bodies natively. Use k6 for dynamic email generation in load tests.

**Expected results**: Same profile as login (< 500ms p95).

**Cleanup**: Delete load test manager rows from Supabase after test.

---

## Test 3: Forgot Password (Fire-and-Forget Path)

```bash
autocannon -c 10 -d 10 -m POST \
  -H "Content-Type: application/json" \
  -b '{"email":"ghost@example.com"}' \
  http://localhost:3000/api/auth/forgot-password
```

**Expected results**:
- Latency p95: < 200ms (returns immediately; DB lookup is fast for non-existent email)
- This endpoint is the fastest auth endpoint due to early return pattern

---

## Test 4: Page Load (SSR)

Use a browser-based tool to measure Time-to-Interactive:

```bash
# Using Lighthouse CLI
npx lighthouse http://localhost:3000/auth/login --only-categories=performance --output=json
```

**Expected score**: Performance > 90 (SSR pages are fast; minimal client JS)

**Key metrics**:
- First Contentful Paint: < 1s
- Time to Interactive: < 3s
- Total Blocking Time: < 100ms

---

## Performance Optimization Notes

At PoC scale (≤ 100 managers, ≤ 20 concurrent), no performance optimisation is needed beyond what's already in place:

1. **bcrypt cost 12**: Deliberately slow for security. Do not reduce below 10.
2. **PgBouncer**: Already configured. Handles connection pooling transparently.
3. **Stateless JWT**: No DB lookup needed for session validation — constant time.
4. **SSR pages**: Next.js SSR with minimal client bundle. No hydration bottleneck.

**When to add more optimisation** (pre-production / > 100 managers):
- Add Redis caching for frequently-read data (teammate profiles, patterns)
- Consider Vercel Pro for larger function memory limits and 30s cron interval
- Add database indexes on hot query paths (will be identified in Units 2–5)

---

---

## Test 5: Interview Next Question Latency

The `/next` endpoint calls `claude-haiku-4-5-20251001` and is bounded by Anthropic's API latency. Run against a **live dev environment** (requires `ANTHROPIC_API_KEY`):

```bash
# Single-request timing — measure wall-clock latency
time curl -s -X POST http://localhost:3000/api/interviews/<id>/next \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<valid-jwt>" \
  -d '{"conversationHistory":[],"latestAnswer":""}' | jq .
```

**Expected results**:
- p50: 1–3 seconds (Haiku model)
- p95: < 5 seconds
- Never exceeds 30 seconds (Vercel `maxDuration` limit)
- On timeout/error: response is `503 { fallback: true }` — not a 504

**Do not load-test Claude endpoints** — Anthropic API rate limits apply. Sequential latency measurement only.

---

## Test 6: Profile Synthesis Latency

```bash
# Build a 7-turn history and call /complete
time curl -s -X POST http://localhost:3000/api/interviews/<id>/complete \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<valid-jwt>" \
  -d '{"conversationHistory":[...7 turns...]}' | jq .
```

**Expected results**:
- p50: 8–15 seconds (Sonnet synthesis model)
- p95: < 20 seconds
- If synthesis exceeds 30s: Claude will return an error, not a timeout — handled as `503 { fallback: true }`

---

## Test 7: Teammate CRUD Endpoints Baseline

```bash
# List endpoint (no AI)
autocannon -c 10 -d 10 -m GET \
  -H "Cookie: session=<valid-jwt>" \
  http://localhost:3000/api/teammates
```

**Expected results**:
- Latency p95: < 200ms (DB read only)
- Requests/sec: > 50 (no bcrypt, no Claude)

---

---

## Test 8: Meeting Paste Endpoint (Unit 3)

```bash
# Single-request timing — paste text, no AI wait
time curl -s -X POST http://localhost:3000/api/meetings/<teammateId>/paste \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<valid-jwt>" \
  -d '{"text":"Sprint review. Team discussed Q2 priorities and aligned on deliverables. Action items assigned."}' | jq .
```

**Expected results**:
- p95: < 300ms (text validation + DB write + enqueue)
- Response does not wait for Claude analysis

---

## Test 9: Meeting Analysis (Cron — Sonnet)

The cron endpoint calls Claude Sonnet and is bounded by Anthropic API latency. Run with a real `ANTHROPIC_API_KEY`:

```bash
# Single cron trigger timing
time curl -s -X GET http://localhost:3000/api/jobs/process-analysis \
  -H "Authorization: Bearer <CRON_SECRET>" | jq .
```

**Expected results**:
- p50: 8–15 seconds (Sonnet analysis model)
- p95: < 30 seconds
- Never exceeds Vercel 60s function timeout
- On failure: `retryCount` incremented; `processed: 0` returned; no 500

**Do not load-test Claude endpoints** — Anthropic API rate limits apply. Sequential latency measurement only.

---

## Test 10: Brief Generation Latency (Unit 4)

```bash
# Single POST timing — Haiku (framework) + Sonnet (brief)
time curl -s -X POST http://localhost:3000/api/brief/<teammateId>/generate \
  -H "Cookie: session=<valid-jwt>" | jq .
```

**Expected results**:
- p50: 5–10 seconds
- p95: < 10 seconds (Haiku + Sonnet in sequence)
- On failure: `200 { brief: null, fallback: {...} }` — not 500

---

## Test 11: Commitment CRUD Endpoints (Unit 5)

```bash
# List commitments (no AI)
autocannon -c 10 -d 10 -m GET \
  -H "Cookie: session=<valid-jwt>" \
  "http://localhost:3000/api/commitments/<teammateId>?status=open"
```

**Expected results**:
- Latency p95: < 200ms (DB read only)
- Requests/sec: > 50

```bash
# PATCH commitment status
time curl -s -X PATCH http://localhost:3000/api/commitments/<id> \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<valid-jwt>" \
  -d '{"action":"done"}' | jq .
```

**Expected results**: < 200ms p95 (single DB write)

---

## Test 12: Growth Summary Latency (Unit 5 — Haiku)

```bash
# Single growth summary timing
time curl -s -X POST http://localhost:3000/api/timeline/<teammateId>/summary \
  -H "Cookie: session=<valid-jwt>" | jq .
```

**Expected results**:
- p50: 1–3 seconds (Haiku model)
- p95: < 5 seconds
- On empty history: `422 { error: "no_history" }` immediately (< 100ms)
- On Claude failure: `200 { summary: null }` — graceful degradation (P-5.02)

---

## Performance Test Schedule

| Phase | When to Run | Targets |
|-------|------------|---------|
| Unit 1 baseline | After Unit 1 deploy | Auth endpoints < 500ms p95 |
| Unit 2 baseline | After Unit 2 deploy | Interview < 5s; synthesis < 20s; CRUD < 200ms |
| Unit 3 baseline | After Unit 3 deploy | Paste < 300ms; analysis cron < 30s |
| Unit 4 baseline | After Unit 4 deploy | Brief generation < 10s p95 |
| Unit 5 baseline | After Unit 5 deploy | Commitment CRUD < 200ms; growth summary < 5s |
| Pre-launch | Before public access | All NFR targets above met at PoC scale (≤20 concurrent) |
