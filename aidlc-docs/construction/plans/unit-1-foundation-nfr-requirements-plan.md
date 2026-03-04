# NFR Requirements Plan — Unit 1: Foundation

## Unit Scope
- Unit 1: Foundation — Auth (register, login, logout, forgot/reset password), Prisma schema, session middleware, Vercel cron scaffold, base layout

## Pre-Established NFRs (from Requirements Analysis)
The following are already decided and will be incorporated without questions:
- Tech stack: Next.js 14+ (Pages Router), Supabase PostgreSQL, Prisma ORM, Vercel deployment, Tailwind CSS
- Auth: JWT (HS256), bcrypt cost 12, httpOnly + Secure + SameSite=Lax cookies, 24h session expiry
- Data isolation: Supabase RLS (chosen in Functional Design)
- Performance: Page TTI < 3 seconds; auth endpoints expected < 500ms
- Scalability target: ~100 managers (MVP / PoC scale)
- Security extension: DISABLED (PoC scope)
- Privacy: Basic — encryption at rest (Supabase managed AES-256), TLS 1.2+ in transit

---

## Part 1: Clarifying Questions

Three decisions need input before generating NFR artifacts.

---

### Question 1
Should basic rate limiting be applied to auth endpoints (login, register, forgot-password) in Unit 1?

Context: These endpoints are common brute-force targets. Even for a PoC, a basic limit (e.g., 5 failed attempts per IP per 15 minutes) adds meaningful protection. However, it adds implementation complexity.

A) **No rate limiting** — Skip for PoC; revisit before production hardening
B) **Basic rate limiting** — Use Vercel Edge middleware or an in-memory rate limiter (e.g., `rate-limiter-flexible`) for login and forgot-password endpoints only
C) Other (please describe after [Answer]: tag below)

[Answer]:A

---

### Question 2
What is the target environment configuration for Unit 1?

A) **Two environments** — `development` (local) and `production` (Vercel + Supabase). Single `.env.local` for local dev.
B) **Three environments** — `development`, `staging`, and `production`. Separate Supabase projects per environment.
C) Other (please describe after [Answer]: tag below)

[Answer]:A

---

### Question 3
What is the error logging and observability strategy for Unit 1?

A) **Console + Vercel logs only** — `console.error` in API routes; viewed via Vercel dashboard. Sufficient for PoC.
B) **Sentry integration** — Add Sentry for structured error tracking with stack traces, environment tagging, and alerting from the start.
C) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## Part 2: Generation Execution Plan

*Executes after answers received.*

### Step 1: NFR Requirements
- [x] Generate `nfr-requirements.md`
  - [x] Performance NFRs for Unit 1 (auth endpoint response times, page TTI)
  - [x] Security NFRs (JWT, bcrypt, cookie flags, HTTPS enforcement)
  - [x] Scalability NFRs (connection pooling config, Supabase limits for 100 users)
  - [x] Availability NFRs (Vercel + Supabase managed SLA)
  - [x] Reliability NFRs (error handling, API error responses)
  - [x] Rate limiting decision (from Q1)
  - [x] Environment configuration (from Q2)
  - [x] Observability / error logging (from Q3)

### Step 2: Tech Stack Decisions
- [x] Generate `tech-stack-decisions.md`
  - [x] Auth libraries: jose for JWT; bcryptjs for hashing
  - [x] Environment variable management strategy
  - [x] Database client: Prisma (confirmed)
  - [x] Email service: Resend (confirmed from Application Design)
  - [x] Rate limiter choice (from Q1 answer — deferred)
  - [x] Error logging tooling (from Q3 answer — console + Vercel logs)
  - [x] Package versions and key dependencies
