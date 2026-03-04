# Infrastructure Design — Unit 1: Foundation

**Date**: 2026-03-01
**Unit**: Unit 1 — Foundation

---

## Infrastructure Overview

| Layer | Service | Plan / Tier | Role |
|-------|---------|------------|------|
| Compute | Vercel | Hobby (free) | Next.js hosting, serverless API routes, cron jobs |
| Database | Supabase | Free tier | PostgreSQL, connection pooling (PgBouncer), RLS enforcement |
| Email | Resend | Free tier (3,000/mo) | Transactional email (password reset) |
| DNS / TLS | Vercel | Included | Automatic HTTPS, default `.vercel.app` domain |
| Monitoring | Vercel Logs | Included | Function logs, error visibility |

---

## Compute: Vercel Serverless Functions

### Function Mapping

Each Next.js API route becomes an independent serverless function on Vercel:

| Route | Function | Runtime | Trigger |
|-------|----------|---------|---------|
| `POST /api/auth/register` | `pages/api/auth/register.ts` | Node.js 20.x | HTTP |
| `POST /api/auth/login` | `pages/api/auth/login.ts` | Node.js 20.x | HTTP |
| `POST /api/auth/logout` | `pages/api/auth/logout.ts` | Node.js 20.x | HTTP |
| `POST /api/auth/forgot-password` | `pages/api/auth/forgot-password.ts` | Node.js 20.x | HTTP |
| `POST /api/auth/reset-password` | `pages/api/auth/reset-password.ts` | Node.js 20.x | HTTP |
| `GET /api/jobs/process-analysis` | `pages/api/jobs/process-analysis.ts` | Node.js 20.x | Vercel Cron |

### Function Constraints (Vercel Hobby)
- **Max execution duration**: 10 seconds (Hobby tier)
- **Max memory**: 1024 MB per function
- **Cold start**: ~200–500ms (acceptable; combined with bcrypt ~250ms = p99 ~1s for login)
- **Concurrency**: Auto-scaled; no manual config needed at PoC scale

### Cron Configuration (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/jobs/process-analysis",
      "schedule": "*/30 * * * *"
    }
  ]
}
```
**Note**: Vercel Hobby supports cron jobs with minimum interval of 1 day. The 30-second interval requires **Vercel Pro**. For PoC, either upgrade to Pro or adjust interval to `0 * * * *` (hourly) on Hobby. Unit 1 scaffold returns `{ processed: 0 }` regardless — interval is not critical in Unit 1.

### Page Rendering
- Auth pages (login, register, forgot-password, reset-password): **SSR** via `getServerSideProps`
- Dashboard shell: **SSR** via `withAuth` HOC
- All pages served from Vercel Edge Network CDN (HTML cached at edge after first SSR)

---

## Database: Supabase PostgreSQL

### Project Configuration
- **Region**: Closest to primary users (e.g., `us-east-1` for US-based PoC)
- **PostgreSQL version**: 15.x (Supabase managed)
- **Extensions**: None required for Unit 1

### Connection Architecture

```
Vercel Functions (runtime)
  |
  |-- DATABASE_URL ──────> Supabase PgBouncer (port 6543)
  |                              |
  |                              └──> PostgreSQL (port 5432)
  |
  |-- DIRECT_URL  ──────> PostgreSQL direct (port 5432)
                          [Used ONLY by: prisma migrate deploy]
```

### Connection String Formats
```
DATABASE_URL (pooled):
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

DIRECT_URL (direct):
postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres
```

**`connection_limit=1`** in `DATABASE_URL`: Required when using PgBouncer in transaction mode with Prisma. Prisma manages its own internal pool; PgBouncer manages the pool to PostgreSQL.

### Row Level Security (RLS)
- RLS enabled on all 8 tables (applied via Prisma migration SQL)
- `app.manager_id` session variable set per-request inside each DB transaction
- Supabase service role key (bypasses RLS): used ONLY by cron job in Unit 3; not needed in Unit 1

### Database Migration Strategy
- Migrations managed by Prisma (`prisma migrate dev` / `prisma migrate deploy`)
- Migration files committed to repository in `prisma/migrations/`
- Production migration run as part of deployment: `prisma migrate deploy` in Vercel build command

### Supabase Dashboard Access
- RLS policies: Applied via migration SQL (not Supabase dashboard UI)
- Table viewer: Available for debugging in Supabase dashboard
- Logs: Available in Supabase dashboard for slow queries

---

## Email: Resend

### Configuration
- **API endpoint**: `https://api.resend.com/emails` (called from Vercel functions)
- **From address**: `noreply@resend.dev` (Resend's shared domain for PoC — no custom domain needed)
- **Volume**: Password reset emails only; well within free tier (3,000/month)

### Email Flow
```
Vercel Function (/api/auth/forgot-password)
  |
  |-- HTTP POST ──> api.resend.com/emails
  |                  |
  |                  └──> Manager's inbox (reset link)
  |
  └── Response logged (errors caught silently per Pattern 8)
```

### Custom Domain (Future)
- For production hardening: configure a sending domain in Resend dashboard
- Requires DNS TXT/MX records on owned domain
- Not needed for PoC — `resend.dev` shared domain works

---

## Network & Security Boundaries

```
Internet
  |
  |── HTTPS (TLS 1.3) ──> Vercel Edge Network
                                |
                                |── Static assets (CDN-cached)
                                |── Serverless function invocations
                                      |
                                      |── bcrypt, JWT, cookie logic (in-process)
                                      |
                                      |── PostgreSQL (TLS) ──> Supabase PgBouncer
                                      |
                                      |── HTTPS ──> Resend API
```

### Trust Boundaries
| Boundary | Protection |
|----------|-----------|
| Client ↔ Vercel | TLS 1.3 (Vercel-managed cert); `Secure` cookie flag |
| Vercel function ↔ Supabase | TLS; Supabase password auth; RLS policy enforcement |
| Vercel function ↔ Resend | TLS; API key authentication |
| Vercel cron ↔ `/api/jobs/process-analysis` | `CRON_SECRET` header (shared secret) |

---

## Environment Variable Inventory

### Development (`.env.local` — local only, git-ignored)

| Variable | Example Value | Source |
|----------|--------------|--------|
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pw]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` | Supabase dashboard → Settings → Database |
| `DIRECT_URL` | `postgresql://postgres.[ref]:[pw]@db.[ref].supabase.co:5432/postgres` | Supabase dashboard → Settings → Database |
| `SECRET_KEY` | `<32+ random chars>` | `openssl rand -base64 32` |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` | Resend dashboard → API Keys |
| `CRON_SECRET` | `<random string>` | `openssl rand -hex 16` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Hardcoded for local dev |

### Production (Vercel Dashboard → Environment Variables)

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Production Supabase project pooled URL |
| `DIRECT_URL` | Production Supabase project direct URL |
| `SECRET_KEY` | Unique production value (different from dev) |
| `RESEND_API_KEY` | Same Resend account; same key works for PoC |
| `CRON_SECRET` | Vercel auto-injects for cron; also set manually |
| `NEXT_PUBLIC_APP_URL` | `https://<project-name>.vercel.app` |

---

## Supabase Setup Checklist (One-Time)

- [ ] Create Supabase project (free tier)
- [ ] Note project ref, region, and connection strings
- [ ] Enable RLS on all tables (applied via `prisma migrate deploy`)
- [ ] Run initial migration: `npx prisma migrate deploy`
- [ ] Verify RLS policies applied in Supabase SQL editor
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` if Supabase JS client used later (not needed for Unit 1 — Prisma only)

---

## Vercel Setup Checklist (One-Time)

- [ ] Connect GitHub repository to Vercel project
- [ ] Set all environment variables in Vercel dashboard (Production)
- [ ] Set build command: `prisma generate && next build`
- [ ] Set install command: `npm install`
- [ ] Add `vercel.json` with cron configuration to repository
- [ ] Confirm deployment succeeds on `main` branch push
- [ ] Verify auth routes accessible at `https://<project>.vercel.app/auth/login`
