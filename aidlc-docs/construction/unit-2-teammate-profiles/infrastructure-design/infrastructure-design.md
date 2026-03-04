# Infrastructure Design — Unit 2: Teammate Profiles

**Date**: 2026-03-01
**Unit**: Unit 2: Teammate Profiles
**Stories**: US-03, US-04

---

## Infrastructure Overview

Unit 2 uses the same two-tier infrastructure established in Unit 1, with one new external dependency (Anthropic Claude API) and two route-level configuration changes.

```
Developer / Browser
      |
      v
  Vercel Edge Network (CDN + routing)
      |
      |-- Static assets (.next/static/) --> served from CDN
      |
      |-- SSR page requests (/teammates/*, /*)
      |       --> Vercel Serverless Function (Next.js server runtime)
      |               --> Supabase PostgreSQL (via Prisma, PgBouncer)
      |
      |-- API requests (/api/teammates/*, /api/interviews/*)
              --> Vercel Serverless Function (Next.js API route)
                      |-- Supabase PostgreSQL  (CRUD ops)
                      |-- Anthropic Claude API (interview + synthesis)  [NEW]
```

---

## 1. Compute: Vercel Serverless Functions

### Route-to-Function Mapping

| Route | Function | Max Duration | Memory | Notes |
|-------|----------|-------------|--------|-------|
| `GET /api/teammates` | `pages/api/teammates/index.ts` | 10s (default) | 1792 MB | DB query only |
| `POST /api/teammates` | `pages/api/teammates/index.ts` | 10s (default) | 1792 MB | DB insert only |
| `GET /api/teammates/[id]` | `pages/api/teammates/[id].ts` | 10s (default) | 1792 MB | DB query only |
| `PATCH /api/teammates/[id]` | `pages/api/teammates/[id].ts` | 10s (default) | 1792 MB | DB update only |
| `DELETE /api/teammates/[id]` | `pages/api/teammates/[id].ts` | 10s (default) | 1792 MB | Cascade delete |
| `POST /api/interviews/[id]/next` | `pages/api/interviews/[teammateId]/next.ts` | **30s** | 1792 MB | Claude Haiku call |
| `POST /api/interviews/[id]/complete` | `pages/api/interviews/[teammateId]/complete.ts` | **30s** | 1792 MB | Claude Sonnet call |
| `GET /teammates/[id]/interview` | SSR page function | 10s (default) | 1792 MB | Reads teammate record |
| `GET /teammates/[id]` | SSR page function | 10s (default) | 1792 MB | Reads teammate + profile |
| `GET /` (dashboard) | SSR page function (existing) | 10s (default) | 1792 MB | Enhanced: reads teammates |

### Extended Timeout Configuration

Interview routes require `maxDuration: 30` to accommodate Claude Haiku (~2s) and Claude Sonnet (~12s) with retry headroom:

```typescript
// pages/api/interviews/[teammateId]/next.ts
export const config = { maxDuration: 30 }

// pages/api/interviews/[teammateId]/complete.ts
export const config = { maxDuration: 30 }
```

> **Vercel Hobby tier**: `maxDuration` up to 60s is supported. The 30s setting is within plan limits.

### Inherited Constraints (Unit 1, unchanged)

- No persistent memory between invocations (stateless functions)
- Cold start: ~200–400ms for Node.js runtime
- No background processing in this unit (async queue introduced in Unit 3)

---

## 2. External Service: Anthropic Claude API

**Service**: Anthropic Claude API (`api.anthropic.com`)
**Access**: HTTPS REST, authenticated via `Authorization: x-api-key` header (managed by `@anthropic-ai/sdk`)

### Endpoint Usage

| Claude Endpoint | Used By | Model | Max Tokens | Estimated Latency |
|----------------|---------|-------|------------|------------------|
| `POST /v1/messages` | `nextQuestion()` | `claude-haiku-4-5-20251001` | 300 | ~1–3s |
| `POST /v1/messages` | `generateProfile()` | `claude-sonnet-4-6` | 1024 | ~8–15s |

### API Key Management

| Environment | Storage Location | Access |
|------------|-----------------|--------|
| Development | `.env.local` → `ANTHROPIC_API_KEY` | Local Next.js dev server only |
| Production | Vercel Environment Variables → `ANTHROPIC_API_KEY` | Vercel serverless runtime only |

**Key isolation rule**: `ANTHROPIC_API_KEY` is a server-only variable. It must never appear in any `NEXT_PUBLIC_*` variable or be referenced from client-side code.

### Network Considerations

- Calls originate from Vercel serverless functions (US-East-1 by default on Hobby tier)
- Anthropic API is hosted in the US — low cross-region latency
- No VPC peering or IP allowlisting required (Anthropic API is public)
- TLS 1.2+ enforced by `@anthropic-ai/sdk`

### Retry and Timeout Behaviour

```
Request to Anthropic API
  │
  ├─ Success (2xx) ──────────────────────────── return response
  │
  ├─ Transient error (5xx, 529, network)
  │     └─ Wait 1000ms → retry once
  │           ├─ Success ──────────────────── return response
  │           └─ Failure ───────────────────── throw → 503 to client
  │
  └─ Non-transient error (4xx excl. 429)
        └─ throw immediately → 503 to client
```

Hard timeout: Vercel function terminates at 30s, which serves as the outer timeout boundary.

---

## 3. Database: Supabase PostgreSQL

**No schema changes in Unit 2.** The full schema was migrated in Unit 1. Unit 2 uses the existing `teammates` table exclusively.

### Table Usage

| Table | Operations | Via |
|-------|-----------|-----|
| `teammates` | SELECT, INSERT, UPDATE, DELETE | Prisma → PgBouncer |
| `managers` | SELECT (ownership check via JOIN in `withAuth`) | Prisma → PgBouncer (inherited) |

### Connection Routing (unchanged from Unit 1)

```
Vercel Function
  └─ Prisma Client
        ├─ DATABASE_URL (port 6543) ──── PgBouncer ──── PostgreSQL
        │   (runtime queries: SELECT, INSERT, UPDATE, DELETE)
        └─ DIRECT_URL (port 5432) ──────────────────── PostgreSQL
            (migrations only — not used at runtime)
```

### No New Migrations Required

The `teammates` table and `profile Json?` column were created in Unit 1's initial migration. Unit 2 reads and writes to the existing schema with no DDL changes.

---

## 4. Environment Variables

### Complete `.env.local` After Unit 2

```bash
# Unit 1 (unchanged)
DATABASE_URL=postgresql://[user]:[password]@[host]:6543/[db]?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://[user]:[password]@[host]:5432/[db]
SECRET_KEY=local-dev-secret-key-32chars-min!!
RESEND_API_KEY=re_placeholder
CRON_SECRET=local-cron-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Unit 2 (new)
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Vercel Production Variables (additions)

Add in Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Environments | Value |
|----------|-------------|-------|
| `ANTHROPIC_API_KEY` | Production, Preview | Your Anthropic API key |

---

## 5. No New Infrastructure Services

The following were considered and explicitly **not** introduced in Unit 2:

| Service | Decision | Reason |
|---------|----------|--------|
| Redis / KV store | Not needed | Interview state is client-side; no server-side caching required |
| Message queue | Not needed | No async processing in Unit 2 (introduced in Unit 3 for meeting analysis) |
| File storage | Not needed | No file uploads in Unit 2 |
| CDN for AI responses | Not needed | Responses are user-specific; cannot be cached |
| Dedicated AI proxy | Not needed | Direct Anthropic API call is sufficient at PoC scale |

---

## 6. Security Boundary Diagram

```
┌─────────────────────────────────────────────────┐
│  Browser (Public)                               │
│  - React UI                                     │
│  - InterviewSessionState (client memory only)   │
│  - JWT session cookie (httpOnly, not readable)  │
└───────────────────┬─────────────────────────────┘
                    │ HTTPS
┌───────────────────▼─────────────────────────────┐
│  Vercel Serverless Functions (Trusted)          │
│  - withAuth validates JWT                       │
│  - managerId from session only                  │
│  - ANTHROPIC_API_KEY (env var, not in bundle)   │
│  - Input sanitization before prompts            │
└──────────┬─────────────────┬────────────────────┘
           │ Prisma (TLS)    │ HTTPS
┌──────────▼──────┐  ┌───────▼────────────────────┐
│ Supabase        │  │ Anthropic Claude API        │
│ PostgreSQL      │  │ claude-haiku / claude-sonnet│
│ RLS policies    │  │ (external, not in VPC)      │
│ (defense layer) │  └────────────────────────────┘
└─────────────────┘
```

---

## 7. Setup Checklists

### Local Development Setup (Unit 2 Additions)

- [ ] Obtain Anthropic API key from `console.anthropic.com`
- [ ] Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env.local`
- [ ] Run `npm install` (adds `@anthropic-ai/sdk`)
- [ ] Verify API key works: `node -e "const Anthropic = require('@anthropic-ai/sdk'); const a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); a.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }).then(r => console.log('OK:', r.content[0].text))"`
- [ ] Restart `npm run dev` after `.env.local` changes

### Vercel Production Setup (Unit 2 Additions)

- [ ] Add `ANTHROPIC_API_KEY` in Vercel dashboard for Production and Preview environments
- [ ] Redeploy after adding the environment variable
- [ ] Verify interview route timeout: confirm `maxDuration: 30` is respected (check function logs for any timeout errors)
