# NFR Requirements — Unit 1: Foundation

**Date**: 2026-03-01
**Unit**: Unit 1 — Foundation (Auth, DB Schema, Session Middleware, Cron Scaffold, Base Layout)

---

## NFR-1: Performance

### NFR-1.1: Auth Endpoint Response Time
- **Target**: All auth API routes (`/api/auth/*`) MUST respond within **500ms** at p95 under expected load
- **Rationale**: bcrypt at cost factor 12 takes ~250ms on modern hardware; remaining budget covers DB lookup and JWT signing
- **Measurement**: Vercel function duration logs

### NFR-1.2: Page Time-to-Interactive (TTI)
- **Target**: Auth pages (login, register, forgot-password, reset-password) MUST be interactive within **3 seconds** on standard broadband (25 Mbps)
- **Rationale**: From global NFR-06 in requirements.md
- **Implementation**: Next.js server-side rendering (via `getServerSideProps`) minimizes client-side JS bundle for auth pages

### NFR-1.3: Dashboard Shell Load
- **Target**: Dashboard page shell (Unit 1 placeholder) MUST render within **3 seconds** TTI
- No heavy data fetching in Unit 1 — shell only

---

## NFR-2: Security

### NFR-2.1: Password Hashing
- Algorithm: **bcrypt** with cost factor **12**
- Library: `bcryptjs` (pure JS, no native bindings — Vercel serverless compatible)
- Plain-text passwords MUST NEVER appear in logs, error messages, or API responses

### NFR-2.2: Session Token Security
- JWT signed with **HS256** algorithm using `SECRET_KEY` environment variable
- `SECRET_KEY` MUST be at minimum 32 characters of cryptographically random bytes
- Token payload: `{ managerId, email, exp }` — minimal surface area
- Tokens MUST NOT contain sensitive data (no passwordHash, no PII beyond email)

### NFR-2.3: Cookie Security Flags
- `httpOnly: true` — prevents JavaScript access (XSS mitigation)
- `Secure: true` — HTTPS-only transmission
- `SameSite: Lax` — CSRF protection while permitting top-level GET navigations
- No `Max-Age` / `Expires` on the cookie itself — JWT `exp` is the authoritative expiry

### NFR-2.4: HTTPS Enforcement
- Vercel enforces HTTPS on all custom domains automatically
- Local development uses HTTP (acceptable for dev environment only)
- `Secure` cookie flag is conditionally set: `process.env.NODE_ENV === 'production'`

### NFR-2.5: Password Reset Token Security
- Reset tokens: **32 bytes** from `crypto.randomBytes` (Node.js built-in)
- Only SHA-256 hash stored in DB; raw token transmitted in email only
- Tokens expire after **60 minutes** and are single-use (atomic `usedAt` marking)

### NFR-2.6: SQL Injection Prevention
- All DB queries via **Prisma ORM** — parameterized queries by default
- No raw SQL in Unit 1 (RLS policies are managed via Supabase console / migration files, not runtime raw queries)

### NFR-2.7: No Rate Limiting (PoC Decision)
- Rate limiting on auth endpoints is **deferred** for PoC (Q1: Answer A)
- This is a documented technical debt item to address before production launch
- **Risk**: Brute-force attacks on login and forgot-password endpoints are possible in PoC state
- **Mitigation at PoC**: Limited user base (~100 managers), no public marketing, obscurity

### NFR-2.8: Environment Variable Security
- Secrets stored as Vercel environment variables (not committed to repository)
- `.env.local` used for local development (git-ignored via `.gitignore`)
- Required secrets: `DATABASE_URL`, `DIRECT_URL`, `SECRET_KEY`, `RESEND_API_KEY`, `CRON_SECRET`

---

## NFR-3: Scalability

### NFR-3.1: Expected Load (PoC Scale)
- Target: **~100 managers**, each managing 5–10 teammates
- Peak concurrent sessions: estimated **< 20** for PoC
- Auth endpoints: stateless (no server-side session store) — horizontally scalable by default via Vercel serverless

### NFR-3.2: Database Connection Pooling
- Supabase provides **PgBouncer** connection pooler at `DATABASE_URL`
- `DIRECT_URL` (direct PostgreSQL connection) used by Prisma migrations only
- Prisma generates queries through PgBouncer for runtime operations
- Connection pool size: Supabase free tier allows up to **60 direct connections** — sufficient at PoC scale

### NFR-3.3: Stateless API Design
- Auth API routes are stateless — session state lives in the JWT cookie, not server memory
- No sticky sessions or server affinity required
- Vercel serverless functions scale to zero automatically between requests

---

## NFR-4: Availability

### NFR-4.1: Hosting SLA
- **Vercel**: 99.99% uptime SLA (managed — no ops burden)
- **Supabase**: 99.9% uptime SLA on paid tier; free tier is best-effort
- PoC runs on free tiers — acceptable for prototype phase

### NFR-4.2: Cold Start Tolerance
- Vercel serverless functions may experience cold starts (~200–500ms)
- Combined with bcrypt (~250ms), p99 auth response time could reach ~1 second — acceptable

### NFR-4.3: Database Availability
- Supabase manages PostgreSQL replication and failover
- No custom failover logic needed in Unit 1

---

## NFR-5: Reliability

### NFR-5.1: API Error Response Format
All API routes MUST return consistent JSON error responses:
```json
{
  "error": "Human-readable error message"
}
```
- Auth errors: `401 Unauthorized` with appropriate message
- Validation errors: `400 Bad Request`
- Server errors: `500 Internal Server Error` with generic message ("Something went wrong. Please try again.")
- No stack traces exposed in error responses

### NFR-5.2: Error Logging
- Strategy: **Console + Vercel logs only** (Q3: Answer A)
- Use `console.error(error)` in API route catch blocks
- Vercel dashboard aggregates logs per deployment
- No structured log shipping for PoC
- PII (email, managerId) MAY appear in server-side logs — acceptable for PoC; sanitize before production

### NFR-5.3: Graceful Degradation
- Email send failures (Resend API) on forgot-password MUST NOT expose errors to client (anti-enumeration)
- Password reset failure logs the error server-side but returns the standard success message
- DB connection failures return `500` with generic message

---

## NFR-6: Maintainability

### NFR-6.1: TypeScript
- Strict TypeScript throughout (`strict: true` in `tsconfig.json`)
- All API route handlers typed with `NextApiRequest` / `NextApiResponse`
- No `any` types in auth-related code

### NFR-6.2: Environment Configuration
- **Two environments**: `development` (local) and `production` (Vercel) — Q2: Answer A
- No staging environment for PoC
- Environment-specific behaviour controlled by `NODE_ENV` (`development` | `production`)

### NFR-6.3: Code Organisation
- Auth logic in `/pages/api/auth/` (Next.js API routes)
- Shared auth utilities in `/lib/auth.ts` (JWT sign/verify, cookie helpers)
- Middleware (withAuth HOC) in `/lib/withAuth.ts`
- Database client singleton in `/lib/prisma.ts`

---

## NFR-7: Usability

### NFR-7.1: Browser Support
- Chrome (latest 2 versions): full support
- Safari (latest 2 versions): full support
- Firefox: best-effort

### NFR-7.2: Responsive Design
- Auth pages: desktop-first, functional at 1280px+ minimum
- Tailwind CSS utility classes for layout
- No mobile-specific layouts in Unit 1

### NFR-7.3: Accessibility (Basic)
- All form inputs have associated `<label>` elements
- Error messages linked to inputs via `aria-describedby`
- Submit buttons have descriptive text (not just icons)
- Password show/hide toggle: `aria-label` updates dynamically

---

## Technical Debt Log (Unit 1)

| Item | Description | Priority Before Launch |
|------|-------------|----------------------|
| TD-01 | No rate limiting on auth endpoints | HIGH |
| TD-02 | PII in server logs (email in error logs) | MEDIUM |
| TD-03 | No structured log shipping / alerting | MEDIUM |
| TD-04 | No staging environment | LOW |
| TD-05 | Session invalidation is client-side only (stateless JWT) | MEDIUM |
