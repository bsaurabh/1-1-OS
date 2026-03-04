# Build Instructions — 1:1OS

**Date**: 2026-03-03
**Scope**: Units 1–5: Foundation, Teammate Profiles, Meeting Ingestion, Intelligence Engine, Tracker & Timeline (ALL UNITS COMPLETE)

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20.x LTS | `node --version` to check |
| npm | 10.x | Bundled with Node 20 |
| Git | Any recent | For repository checkout |
| Supabase account | — | Free tier; one project needed |
| Resend account | — | Free tier; for password reset emails |
| Vercel account | — | Free (Hobby) tier for deployment |

---

## Step 1: Clone and Install Dependencies

```bash
# Clone repository (if not already done)
git clone <repository-url>
cd testproject

# Install all npm dependencies
npm install
```

**Expected output**: `added N packages` with no errors. If native binding errors appear, they are not expected (all packages use pure JS implementations).

---

## Step 2: Configure Environment Variables

Create `.env.local` in the workspace root (never commit this file):

```bash
# Copy the template below into .env.local and fill in your values
touch .env.local
```

**`.env.local` template** (all 13 variables — Units 1–5):
```
# Unit 1 — Supabase (Dashboard → Project Settings → Database)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres

# Unit 1 — JWT signing secret (generate: openssl rand -base64 32)
SECRET_KEY=<32+ random characters>

# Unit 1 — Resend (Resend Dashboard → API Keys)
RESEND_API_KEY=re_xxxxxxxxxxxx

# Unit 1 — Cron protection (generate: openssl rand -hex 16)
CRON_SECRET=<random hex string>

# Unit 1 — App base URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Unit 2 — Anthropic API (https://console.anthropic.com → API Keys)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx

# Unit 3 — OpenAI (for Whisper transcription)
OPENAI_API_KEY=sk-xxxxxxxxxxxx

# Unit 3 — Web Push (generate: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BExa...
VAPID_PRIVATE_KEY=Exa...
VAPID_SUBJECT=mailto:admin@example.com

# Unit 3 — Supabase Storage (Dashboard → Settings → API)
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Step 3: Generate Prisma Client

```bash
npx prisma generate
```

**Expected output**: `✔ Generated Prisma Client` with no errors.

---

## Step 4: Run Database Migration

```bash
npx prisma migrate deploy
```

This applies all migrations in `prisma/migrations/`:
- `20260301000000_init/` — creates all 8 tables + RLS policies
- `20260302000000_add_retry_count_to_analysis_jobs/` — adds `retryCount` column to `analysis_jobs`

**Expected output**: `All migrations have been successfully applied.`

**Verify in Supabase Dashboard**:
- Go to Database → Tables — confirm all 8 tables exist
- Go to Database → Policies — confirm RLS policies are active on each table

---

## Step 5: Build the Next.js Application

```bash
npm run build
```

This runs `prisma generate && next build` (as configured in `package.json`).

**Expected output**:
```
✓ Compiled successfully
✓ Linting and checking validity of types
Route (pages)                                          Size
┌ ○ /auth/login                                        ...
├ ○ /auth/register                                     ...
├ ○ /auth/forgot-password                              ...
├ ○ /auth/reset-password                               ...
├ ƒ /dashboard                                         ...
├ ƒ /teammates/[id]                                    ... (Profile + tab nav)
├ ƒ /teammates/[id]/interview                          ...
├ ƒ /teammates/[id]/meeting/[meetingId]                ...
├ ƒ /teammates/[id]/brief                              ...
├ ƒ /teammates/[id]/commitments                        ...
├ ƒ /teammates/[id]/timeline                           ...
├ API /api/auth/forgot-password                        ...
├ API /api/auth/login                                  ...
├ API /api/auth/logout                                 ...
├ API /api/auth/register                               ...
├ API /api/auth/reset-password                         ...
├ API /api/brief/[teammateId]/generate                 ...
├ API /api/commitments/[id]                            ...
├ API /api/commitments/[teammateId]                    ...
├ API /api/interviews/[teammateId]/complete            ...
├ API /api/interviews/[teammateId]/next                ...
├ API /api/jobs/process-analysis                       ...
├ API /api/meetings/[teammateId]/[meetingId]           ...
├ API /api/meetings/[teammateId]/paste                 ...
├ API /api/meetings/[teammateId]/save-transcription    ...
├ API /api/meetings/[teammateId]/upload                ...
├ API /api/notifications/subscribe                     ...
├ API /api/teammates/[id]                              ...
├ API /api/teammates/index                             ...
├ API /api/timeline/[teammateId]                       ...
├ API /api/timeline/[teammateId]/summary               ...
├ API /api/transcription/[fileId]                      ...
├ API /api/transcription/start                         ...
└ API /api/transcription/transcribe                    ...
```

**Common build failures**:

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module '@prisma/client'` | Prisma not generated | Run `npx prisma generate` |
| `Type error: ...` | TypeScript strict violation | Fix the flagged type in the reported file |
| `Environment variable not found: SECRET_KEY` | Missing `.env.local` | Create `.env.local` with all required vars |

---

## Step 6: Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — should redirect to `/auth/login`.

**Smoke-test checklist**:
- [ ] `/auth/login` renders the login page
- [ ] `/auth/register` renders the register page
- [ ] `/auth/forgot-password` renders the forgot password page
- [ ] `/dashboard` redirects to `/auth/login` when not authenticated
- [ ] Register a new account — redirects to dashboard
- [ ] Log out — redirects to login
- [ ] Login with the registered account — redirects to dashboard
- [ ] Dashboard shows teammate list (empty state if no teammates)
- [ ] "Add Teammate" button opens modal; submitting name + role navigates to interview page
- [ ] Interview page loads first question from Claude (requires `ANTHROPIC_API_KEY`)
- [ ] Profile page renders after interview completes

---

## Production Build (Vercel Deployment)

### One-Time Vercel Setup

1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `vercel link`
3. Add environment variables in Vercel dashboard (Settings → Environment Variables):
   - `DATABASE_URL` (production Supabase)
   - `DIRECT_URL` (production Supabase)
   - `SECRET_KEY` (unique production value)
   - `RESEND_API_KEY`
   - `CRON_SECRET`
   - `NEXT_PUBLIC_APP_URL` = `https://<project>.vercel.app`
   - `ANTHROPIC_API_KEY` (Anthropic console — added Unit 2)

### Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

Vercel automatically runs the build command: `prisma generate && prisma migrate deploy && next build`

### Verify production deployment
- [ ] `https://<project>.vercel.app/auth/login` renders
- [ ] Register, login, logout flow works end-to-end
- [ ] Forgot-password email is received (check Resend dashboard for delivery)
