# Tech Stack Decisions — Unit 2: Teammate Profiles

**Date**: 2026-03-01
**Unit**: Unit 2: Teammate Profiles

---

## New Dependencies (Unit 2 Additions)

| Package | Version | Purpose | Decision Rationale |
|---------|---------|---------|-------------------|
| `@anthropic-ai/sdk` | `^0.39.0` | Claude API client (Haiku + Sonnet) | Official Anthropic SDK; edge-runtime compatible; supports non-streaming and streaming; maintained by Anthropic |

**Install command**:
```bash
npm install @anthropic-ai/sdk
```

No other new runtime dependencies are introduced in Unit 2. All other packages (Prisma, Next.js, Tailwind, jose, bcryptjs, Resend) are inherited from Unit 1.

---

## Claude Model Selection

| Use Case | Model ID | Rationale |
|----------|----------|-----------|
| Interview question generation | `claude-haiku-4-5-20251001` | Fastest Claude model; adequate intelligence for generating contextual interview questions; low latency (~1–2s) keeps the interview feel conversational |
| Profile synthesis | `claude-sonnet-4-6` | Higher reasoning capability needed to synthesize 7 free-form Q&A pairs into a coherent, structured profile; one-time call per interview, latency trade-off is acceptable |

**Model ID constants** (defined in `handlers/interviewAIHandler.ts`):
```typescript
const INTERVIEW_MODEL = 'claude-haiku-4-5-20251001'
const SYNTHESIS_MODEL = 'claude-sonnet-4-6'
```

---

## Anthropic SDK Usage Pattern

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Non-streaming message call (used for both interview questions and synthesis)
const message = await anthropic.messages.create({
  model: INTERVIEW_MODEL,           // or SYNTHESIS_MODEL
  max_tokens: 300,                  // 300 for questions, 1024 for synthesis
  messages: [
    { role: 'user', content: prompt }
  ],
})

const text = message.content[0].type === 'text' ? message.content[0].text : ''
```

**Singleton pattern**: The Anthropic client is instantiated once per module (not per request). In serverless environments each invocation gets its own module scope — no shared state concerns.

---

## Retry Implementation

```typescript
async function callClaudeWithRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 1000
): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const isRetryable = isTransientError(err)
    if (retries > 0 && isRetryable) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
      return callClaudeWithRetry(fn, retries - 1, delayMs)
    }
    throw err
  }
}

function isTransientError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    // Retry on 5xx and 529 (overloaded), not on 4xx
    return err.status >= 500 || err.status === 529
  }
  // Retry on network errors (no status)
  return err instanceof Error && err.message.includes('fetch')
}
```

**Max retries**: 1 (single retry). Non-retryable errors (400, 401, 403) fail immediately.

---

## Vercel Function Configuration

Interview and synthesis routes require extended timeout (30s) beyond the Vercel default (10s on Hobby):

```typescript
// pages/api/interviews/[teammateId]/next.ts
export const config = {
  maxDuration: 30,
}

// pages/api/interviews/[teammateId]/complete.ts
export const config = {
  maxDuration: 30,
}
```

> **Note**: `maxDuration: 30` is supported on Vercel Hobby for serverless functions. Verify in Vercel dashboard that the functions are not being capped at the plan limit.

CRUD routes (`/api/teammates/*`) do not need extended timeout — they use the default 10s limit.

---

## Environment Variables (Unit 2 Additions)

| Variable | Where Set | Description |
|----------|-----------|-------------|
| `ANTHROPIC_API_KEY` | `.env.local` (dev) + Vercel dashboard (prod) | Anthropic API key for Claude access |

**Full `.env.local` after Unit 2** (add to existing Unit 1 variables):
```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SECRET_KEY=local-dev-secret-key-32chars-min!!
RESEND_API_KEY=re_...
CRON_SECRET=local-cron-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
ANTHROPIC_API_KEY=sk-ant-...
```

**Critical**: `ANTHROPIC_API_KEY` must NOT have the `NEXT_PUBLIC_` prefix. Exposing it client-side would allow anyone to make Claude API calls at the developer's expense.

---

## Inherited Tech Stack Decisions (No Changes from Unit 1)

| Decision | Value |
|----------|-------|
| Framework | Next.js 14 (Pages Router) |
| Language | TypeScript (strict mode) |
| ORM | Prisma v5 (dual-URL for PgBouncer + migrations) |
| Database | Supabase PostgreSQL |
| Auth | `jose` v5 JWT + httpOnly cookie |
| Password hashing | `bcryptjs` v2 (cost factor 12) |
| Email | Resend |
| Styling | Tailwind CSS v3 |
| Testing | Jest + ts-jest |
| Hosting | Vercel (serverless, Pages Router) |
| Logging | Console only |
| Environments | development + production |

---

## Token Budget

| Call | `max_tokens` | Rationale |
|------|-------------|-----------|
| `nextQuestion` (Haiku) | `300` | Questions are short (1–3 sentences). 300 tokens is generous. |
| `generateProfile` (Sonnet) | `1024` | JSON object with 7 fields, each 1–3 sentences. ~150 tokens per field × 7 = ~1050; 1024 is sufficient with concise synthesis. |

---

## Decision Log

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 1 | `@anthropic-ai/sdk` (official) | Raw `fetch` to Anthropic REST API | SDK handles auth, retries, TypeScript types, and future API changes automatically |
| 2 | Non-streaming responses | SSE streaming | Simpler implementation; Haiku latency is low enough that non-streaming feels acceptable; avoids SSE complexity in serverless |
| 3 | 30s timeout via `maxDuration` | 10s default | Sonnet synthesis can take 8–12s for a 7-turn interview; 30s provides safe headroom |
| 4 | Single retry (1s delay) | No retry / 3-retry backoff | Handles transient Claude overload (common during peak hours) without unacceptable wait time |
| 5 | Model IDs as constants | Config file / env vars | Model IDs are intentional code decisions, not deployment configuration; constants are cleaner and version-controlled |
| 6 | Haiku for questions, Sonnet for synthesis | Sonnet for everything | Cost and latency optimisation — 7 Haiku calls + 1 Sonnet call per interview is significantly cheaper than 8 Sonnet calls |
