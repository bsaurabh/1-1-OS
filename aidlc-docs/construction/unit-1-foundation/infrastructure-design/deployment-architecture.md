# Deployment Architecture — Unit 1: Foundation

**Date**: 2026-03-01
**Unit**: Unit 1 — Foundation

---

## Component-to-Service Mapping

```
APPLICATION COMPONENTS                INFRASTRUCTURE SERVICES
-----------------------               -----------------------

pages/auth/login.tsx    ─────────────> Vercel Edge (SSR + CDN)
pages/auth/register.tsx ─────────────> Vercel Edge (SSR + CDN)
pages/auth/forgot-*     ─────────────> Vercel Edge (SSR + CDN)
pages/auth/reset-*      ─────────────> Vercel Edge (SSR + CDN)
pages/dashboard/        ─────────────> Vercel Edge (SSR + CDN)

pages/api/auth/register ─────────────> Vercel Serverless Function
pages/api/auth/login    ─────────────> Vercel Serverless Function
pages/api/auth/logout   ─────────────> Vercel Serverless Function
pages/api/auth/forgot-* ─────────────> Vercel Serverless Function ──> Resend API
pages/api/auth/reset-*  ─────────────> Vercel Serverless Function
pages/api/jobs/process  ─────────────> Vercel Cron Function (30s)

lib/prisma.ts           ─────────────> Supabase PgBouncer ──> PostgreSQL
                                        (RLS: app.manager_id per transaction)

prisma/schema.prisma    ─────────────> Supabase PostgreSQL
prisma/migrations/      ─────────────> Applied via prisma migrate deploy
```

---

## Request Flow: Authenticated Page (Production)

```
Browser
  |
  | HTTPS GET /dashboard
  | Cookie: session=<jwt>
  v
Vercel Edge Network (global CDN)
  |
  | Routes to nearest serverless function instance
  v
withAuth HOC — getServerSideProps
  |
  |-- Extract cookie: req.cookies.session
  |-- jwtVerify(token, SECRET_KEY)
  |     |
  |     |-- Valid  ──> { managerId }
  |     |-- Invalid ─> redirect 308 /auth/login
  |
  |-- return { props: { managerId } }
  v
Next.js SSR: DashboardPage renders server-side HTML
  |
  v
Browser receives HTML (no flash of unauthenticated content)
```

---

## Request Flow: Login (Production)

```
Browser
  |
  | HTTPS POST /api/auth/login
  | Body: { email, password }
  v
Vercel Serverless Function (Node.js 20.x)
  |
  |-- Validate input
  |-- prisma.manager.findUnique({ where: { email } })
  |     |
  |     | TLS connection to Supabase PgBouncer (port 6543)
  |     | SET LOCAL app.manager_id not yet set (pre-auth query)
  |     v
  |   Supabase PostgreSQL
  |     |-- RLS: managers table policy requires app.manager_id
  |     |   NOTE: Login query uses service-level access (no RLS on managers for auth)
  |     |   (Actually: Prisma uses DATABASE_URL which has service role or anon key?)
  |
  |-- bcrypt.compare(password, hash)  ~250ms
  |-- signSessionToken({ managerId, email })
  |-- setSessionCookie(res, token)
  |
  v
Browser: receives 200 { managerId }
         Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Lax
  |
  v
Browser redirects to /dashboard
```

**Note on RLS for auth queries**: The `managers` table RLS policy `managers_self` uses `current_setting('app.manager_id')`. However, the login lookup (finding manager by email to verify password) must run BEFORE `managerId` is known — so RLS would block it.

**Resolution**: The Prisma `DATABASE_URL` connects as the `postgres` service role user (Supabase project owner), which bypasses RLS. Alternatively, add a permissive SELECT policy specifically for the email-lookup query. The recommended approach for PoC is the Supabase service role key in `DATABASE_URL`, which bypasses RLS for all Prisma queries — with RLS serving as a defence against direct DB access (not application queries).

**Revised RLS trust model for PoC**:
- Application layer (Prisma): Always filters by `managerId` in queries (`where: { managerId }`)
- RLS: Protects against direct DB access (SQL editor, DB client tools, SQL injection)
- This is still "defence-in-depth" per BR-18 intent; RLS just doesn't intercept Prisma as the service role

---

## Request Flow: Password Reset Email (Production)

```
Browser
  |
  | HTTPS POST /api/auth/forgot-password
  | Body: { email }
  v
Vercel Serverless Function
  |
  |-- Always return 200 (anti-enumeration)
  |-- Lookup manager by email (Prisma → Supabase)
  |-- If found:
  |     |-- crypto.randomBytes(32) → rawToken
  |     |-- SHA-256(rawToken) → tokenHash
  |     |-- prisma.passwordResetToken.create(...)
  |     |-- Build resetUrl = ${NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${rawToken}
  |     |
  |     |-- HTTPS POST ──> api.resend.com/emails
  |     |                        |
  |     |                        └──> Manager's email inbox
  |     |                              (reset link valid 60 min)
  |     |
  |     └── catch (e) { console.error(e) }  [silent on failure]
  |
  v
Browser: "If an account exists for this email, a reset link has been sent."
```

---

## Development Environment Setup

### Local Stack

```
Developer Machine
  |
  |-- Next.js dev server (localhost:3000)
  |     |-- Hot reload (HMR)
  |     |-- .env.local loaded by Next.js
  |
  |-- TLS: HTTP (not HTTPS) locally
  |   cookie Secure flag: OFF (NODE_ENV=development)
  |
  |-- DATABASE_URL ──> Supabase dev project (remote)
  |   (No local PostgreSQL needed — Supabase free tier handles dev DB)
  |
  |-- RESEND_API_KEY ──> Resend API (sends real emails in dev)
  |   (Or: use Resend's sandbox mode to prevent real delivery)
```

### Local Development Commands

```bash
# Install dependencies
npm install

# Generate Prisma client from schema
npx prisma generate

# Run database migrations (dev)
npx prisma migrate dev --name init

# Start development server
npm run dev

# Open Prisma Studio (DB browser)
npx prisma studio
```

---

## Production Deployment Pipeline

```
Developer pushes to `main` branch
  |
  v
GitHub (repository)
  |
  | Webhook trigger
  v
Vercel Build Pipeline
  |
  |-- npm install
  |-- npx prisma generate     ← generates Prisma client from schema
  |-- npx prisma migrate deploy  ← applies pending migrations to Supabase
  |-- next build              ← compiles Next.js app
  |
  v
Vercel Deploy
  |
  |-- Serverless functions deployed to Vercel's global infrastructure
  |-- Static assets pushed to Vercel Edge CDN
  |-- Cron jobs registered (from vercel.json)
  |
  v
Production live at: https://<project-name>.vercel.app
```

### Build Command (Vercel Project Settings)
```
prisma generate && prisma migrate deploy && next build
```

### Install Command
```
npm install
```

---

## Vercel Configuration (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/jobs/process-analysis",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Note**: Schedule set to hourly (`0 * * * *`) for Vercel Hobby tier compatibility. The 30-second interval from functional design requires Vercel Pro. Unit 1 scaffold returns `{ processed: 0 }` — interval is not material in Unit 1.

---

## Infrastructure Diagram (Text)

```
[Developer]
    |
    | git push → main
    v
[GitHub Repo]
    |
    | webhook
    v
[Vercel Build]
    |-- prisma generate
    |-- prisma migrate deploy ──────────> [Supabase PostgreSQL]
    |-- next build
    v
[Vercel Production]
    |
    |── Edge CDN ──────────────────────> [Browser] (static assets, SSR HTML)
    |
    |── Serverless Functions
    |       |
    |       |── auth/* routes
    |       |── jobs/process-analysis (cron)
    |       |
    |       |── Prisma ────────────────> [Supabase PgBouncer]
    |       |                                    |
    |       |                                    └──> [PostgreSQL + RLS]
    |       |
    |       └── HTTP ──────────────────> [Resend API]
    |                                         |
    |                                         └──> [Manager Email Inbox]
```

---

## Shared Infrastructure

No shared infrastructure across units in Unit 1. The Supabase project and Vercel project established in Unit 1 are reused by all subsequent units (Units 2–5) without modification to the infrastructure layer.

The following are established once in Unit 1 and inherited:
- Supabase project (same project used by all units)
- Vercel project (same project; new API routes added per unit)
- `prisma/schema.prisma` (extended per unit via additive migrations)
- `.env.local` variables (extended per unit as new services added)
