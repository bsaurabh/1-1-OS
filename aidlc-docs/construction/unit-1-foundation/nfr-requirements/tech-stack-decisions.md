# Tech Stack Decisions — Unit 1: Foundation

**Date**: 2026-03-01
**Unit**: Unit 1 — Foundation

---

## Decision Summary

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | Next.js (Pages Router) | 14.x | User selected; Pages Router preferred for simplicity over App Router |
| Language | TypeScript | 5.x | Type safety; strict mode enabled |
| Styling | Tailwind CSS | 3.x | Utility-first; fast UI development for PoC |
| ORM | Prisma | 5.x | Type-safe DB queries; schema-first; integrates with Supabase |
| Database | Supabase PostgreSQL | managed | RLS support; managed hosting; free tier for PoC |
| Auth mechanism | Custom JWT (not Supabase Auth) | — | Full control over session shape and cookie behaviour |
| JWT library | `jose` | 5.x | Web-standard JOSE implementation; edge-runtime compatible; actively maintained |
| Password hashing | `bcryptjs` | 2.x | Pure JS bcrypt; no native bindings → works in Vercel serverless without build issues |
| Email | Resend | latest | Simple API; good Next.js DX; confirmed in Application Design |
| Deployment | Vercel | — | Zero-config Next.js deployment; cron job support |
| Error logging | Console + Vercel logs | — | Sufficient for PoC (Q3: A) |
| Rate limiting | None (PoC) | — | Deferred; documented as TD-01 (Q1: A) |

---

## Detailed Decisions

---

### DEC-01: JWT Library — `jose` (not `jsonwebtoken`)

**Decision**: Use `jose` instead of `jsonwebtoken`

**Rationale**:
- `jsonwebtoken` depends on Node.js `crypto` bindings that may cause issues in Vercel Edge Runtime
- `jose` is a Web-standard implementation (works in Node.js, Edge Runtime, and browsers)
- `jose` is actively maintained and supports ES modules natively
- API is slightly more verbose but safer (forces explicit algorithm selection)

**Key usage**:
```typescript
// Sign
import { SignJWT } from 'jose'
const token = await new SignJWT({ managerId, email })
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('24h')
  .sign(new TextEncoder().encode(process.env.SECRET_KEY))

// Verify
import { jwtVerify } from 'jose'
const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SECRET_KEY))
```

---

### DEC-02: Password Hashing — `bcryptjs` (not `bcrypt`)

**Decision**: Use `bcryptjs` (pure JS implementation)

**Rationale**:
- `bcrypt` (native) requires node-gyp compilation; can fail in Vercel serverless build environments
- `bcryptjs` is a pure JS port — no native bindings, always works in serverless
- Performance is slightly slower (~10–15%) but negligible at cost factor 12 (~250–300ms)
- API is identical to `bcrypt` — easy to swap later if native performance needed

**Key usage**:
```typescript
import bcrypt from 'bcryptjs'
const hash = await bcrypt.hash(password, 12)
const match = await bcrypt.compare(password, hash)
```

---

### DEC-03: Database Client — Prisma with Supabase

**Decision**: Prisma ORM connected to Supabase PostgreSQL

**Two connection strings required**:
- `DATABASE_URL`: PgBouncer pooled connection (for runtime Prisma queries)
  - Format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`
- `DIRECT_URL`: Direct PostgreSQL connection (for Prisma migrations only)
  - Format: `postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres`

**Prisma client singleton** (`lib/prisma.ts`):
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```
**Note**: The singleton pattern prevents creating multiple Prisma clients during Next.js hot reload in development.

---

### DEC-04: Email Service — Resend

**Decision**: Resend for transactional email (password reset)

**Rationale**: Confirmed in Application Design. Simple REST API, generous free tier (3,000 emails/month), excellent Next.js DX.

**Key usage** (Unit 1 — password reset only):
```typescript
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)
await resend.emails.send({
  from: 'noreply@yourdomain.com',
  to: email,
  subject: 'Reset your 1:1OS password',
  html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 60 minutes.</p>`,
})
```

---

### DEC-05: Environment Configuration — Two Environments

**Decision**: `development` (local) + `production` (Vercel) — Q2: A

**Local development** (`.env.local` — git-ignored):
```
DATABASE_URL=postgresql://...?pgbouncer=true
DIRECT_URL=postgresql://...
SECRET_KEY=<32+ random chars>
RESEND_API_KEY=re_...
CRON_SECRET=<random string>
```

**Production** (Vercel environment variables — set via Vercel dashboard):
- Same variable names as `.env.local`
- Set to production Supabase project credentials
- `NODE_ENV=production` set automatically by Vercel

**`.gitignore` additions**:
```
.env.local
.env*.local
```

---

### DEC-06: Error Logging — Console + Vercel Logs

**Decision**: `console.error` + Vercel function logs — Q3: A

**Pattern for all API routes**:
```typescript
try {
  // handler logic
} catch (error) {
  console.error('[/api/auth/login] Unexpected error:', error)
  return res.status(500).json({ error: 'Something went wrong. Please try again.' })
}
```

**Viewing logs**: Vercel dashboard → Project → Logs tab → filter by function path

---

### DEC-07: Rate Limiting — Deferred

**Decision**: No rate limiting in Unit 1 — Q1: A

- Documented as technical debt (TD-01 in nfr-requirements.md)
- When implemented (pre-launch): recommended approach is Vercel Edge Middleware with `@upstash/ratelimit` (Redis-based, works at edge)

---

## Required npm Packages — Unit 1

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "typescript": "^5.0.0",
    "@prisma/client": "^5.0.0",
    "bcryptjs": "^2.4.3",
    "jose": "^5.0.0",
    "resend": "^3.0.0",
    "tailwindcss": "^3.0.0",
    "postcss": "^8.0.0",
    "autoprefixer": "^10.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/bcryptjs": "^2.4.6"
  }
}
```

---

## Environment Variables Reference

| Variable | Used In | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `lib/prisma.ts` | PgBouncer pooled Supabase URL |
| `DIRECT_URL` | `prisma/schema.prisma` | Direct DB URL for migrations |
| `SECRET_KEY` | `lib/auth.ts` | JWT signing secret (min 32 chars) |
| `RESEND_API_KEY` | `lib/email.ts` | Resend API key for password reset email |
| `CRON_SECRET` | `/api/jobs/process-analysis` | Vercel cron authentication header |
| `NODE_ENV` | global | Set by Next.js/Vercel automatically |
| `NEXT_PUBLIC_APP_URL` | `lib/email.ts` | Base URL for reset link construction |
