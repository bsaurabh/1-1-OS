# NFR Design Patterns — Unit 1: Foundation

**Date**: 2026-03-01
**Unit**: Unit 1 — Foundation

---

## Pattern 1: Stateless Session (Security + Scalability)

**NFR addressed**: NFR-2.2, NFR-3.1, NFR-3.3

**Problem**: Session state must be maintained across requests without server-side storage, while remaining secure and tamper-proof.

**Pattern**: Stateless JWT in a signed, httpOnly cookie

**Design**:
```
Client                        Server (Vercel Serverless)
  |                                  |
  |-- POST /api/auth/login --------> |
  |                                  | 1. Verify credentials (bcrypt.compare)
  |                                  | 2. Sign JWT { managerId, email, exp: +24h }
  |                                  | 3. Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Lax
  |<-- 200 { managerId } ----------- |
  |                                  |
  |-- GET /dashboard (cookie sent) ->|
  |                                  | 4. withAuth: extract + verify JWT
  |                                  | 5. Attach managerId to request
  |<-- 200 Dashboard HTML ---------- |
```

**Why stateless**:
- No session store to maintain, scale, or expire
- Vercel serverless functions have no shared memory between invocations
- JWT expiry (`exp`) is self-contained — no DB lookup needed to validate session

**Trade-off logged**: True session revocation (e.g., on password reset) is only effective client-side (cookie cleared). JWT remains cryptographically valid until `exp`. Documented as TD-05.

---

## Pattern 2: Middleware Auth Guard (Security + Reliability)

**NFR addressed**: NFR-2.2, NFR-5.1

**Problem**: Protected pages must reject unauthenticated requests server-side, without relying on client-side redirects.

**Pattern**: Higher-Order Component (HOC) wrapping `getServerSideProps` for server-side auth check

**Design**:
```
Request to protected page
  |
  v
withAuth(Page)
  |-- getServerSideProps runs SERVER-SIDE
  |     |
  |     |-- Extract session cookie
  |     |-- jwtVerify() using SECRET_KEY
  |     |     |
  |     |     |-- Invalid / missing --> { redirect: '/auth/login' }  (308)
  |     |     |-- Expired           --> { redirect: '/auth/login' }  (308)
  |     |     |-- Valid             --> { props: { managerId } }
  |     |
  |     v
  |   Page renders with managerId prop
  v
Response sent to client
```

**Why server-side**: Client-side redirects (useEffect + router.push) cause a flash of protected content. SSR redirect is invisible to the client.

---

## Pattern 3: Defense-in-Depth Data Isolation (Security)

**NFR addressed**: NFR-2.6, NFR-3.1 (from Functional Design RLS design)

**Problem**: Each manager's data must be strictly isolated — no cross-manager data leakage.

**Pattern**: Two-layer isolation — RLS (primary) + managerId in queries (secondary)

**Design**:
```
API Request (authenticated)
  |
  v
Session middleware
  |-- Extracts managerId from JWT
  |-- Passes managerId to DB transaction
  v
Prisma query executes inside Supabase transaction:
  SET LOCAL app.manager_id = '<managerId>'  ← enables RLS
  |
  v
PostgreSQL RLS policy evaluates:
  current_setting('app.manager_id') = manager_id  ← blocks wrong-manager rows
  |
  v
Only the authenticated manager's rows returned
```

**Why both layers**: RLS is the security backstop even if application code has a bug. Prisma `where: { managerId }` is the first line of defence and makes intent explicit in code.

---

## Pattern 4: Timing-Safe Credential Verification (Security)

**NFR addressed**: NFR-2.1, NFR-2.3 (anti-enumeration)

**Problem**: Login response time must be consistent regardless of whether the email exists, to prevent timing-based user enumeration.

**Pattern**: Always run bcrypt.compare, even for non-existent accounts

**Design**:
```
POST /api/auth/login
  |
  |-- Lookup manager by email
  |     |
  |     |-- Found:     use real passwordHash
  |     |-- Not found: use DUMMY_HASH (pre-computed bcrypt hash of empty string)
  |
  v
bcrypt.compare(inputPassword, hash)  ← always runs ~250ms
  |
  |-- Match:    create session, return 200
  |-- Mismatch: return 401 "Incorrect email or password."
```

**DUMMY_HASH**: A pre-computed bcrypt hash stored as a module-level constant. This ensures the timing of the `not found` path matches the `found but wrong password` path.

```typescript
// Computed once at module load — never changes
const DUMMY_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQJQ9K2'
```

---

## Pattern 5: Atomic Token Consumption (Reliability)

**NFR addressed**: NFR-5.1

**Problem**: Password reset tokens must be single-use; concurrent requests using the same token must not both succeed.

**Pattern**: Optimistic lock via immediate `usedAt` timestamp update before password change

**Design**:
```
POST /api/auth/reset-password
  |
  |-- Hash input token (SHA-256)
  |-- Find PasswordResetToken WHERE tokenHash = hash AND usedAt IS NULL
  |     |
  |     |-- Not found or usedAt set --> 400 "This link is no longer valid."
  |     |-- Expired                  --> 400 "This link has expired."
  |
  |-- UPDATE password_reset_tokens SET usedAt = now() WHERE id = token.id
  |   (atomic — Supabase executes in single transaction)
  |
  |-- Hash new password (bcrypt)
  |-- UPDATE managers SET passwordHash = newHash WHERE id = managerId
  |
  v
Return 200 "Password updated. Please log in."
```

**Why order matters**: `usedAt` is marked BEFORE the password is updated. If the password update fails, the token is consumed but password unchanged — user must request a new token. This is the safer failure mode (no partial state).

---

## Pattern 6: Prisma Client Singleton (Performance + Reliability)

**NFR addressed**: NFR-3.2, NFR-6.3

**Problem**: Next.js hot reload in development creates a new `PrismaClient` instance on every module reload, exhausting the connection pool.

**Pattern**: Global singleton using `globalThis` to persist client across hot reloads

**Design**:
```
lib/prisma.ts
  |
  |-- Check globalThis.prisma
  |     |
  |     |-- Exists (dev hot reload): reuse existing client
  |     |-- Not exists:              create new PrismaClient
  |
  |-- In development: attach to globalThis (survives hot reload)
  |-- In production:  module cache handles singleton (each function instance has one client)
```

**Connection config**:
- `DATABASE_URL` points to PgBouncer (pooled): Prisma sends queries through the pool
- `DIRECT_URL` points to direct PostgreSQL: used by `prisma migrate` only

---

## Pattern 7: Consistent API Error Shape (Reliability)

**NFR addressed**: NFR-5.1

**Problem**: Frontend components need a predictable error format to display user-facing messages without ad-hoc parsing.

**Pattern**: Uniform JSON error envelope across all API routes

**Design**:
```typescript
// All error responses follow this shape:
{ "error": "Human-readable message" }

// HTTP status codes:
// 400 — Validation error (bad input)
// 401 — Authentication error (wrong credentials, expired session)
// 409 — Conflict (email already exists)
// 500 — Unexpected server error (generic message only — no internal detail exposed)
```

**Frontend consumption**:
```typescript
const res = await fetch('/api/auth/login', { method: 'POST', body: ... })
if (!res.ok) {
  const { error } = await res.json()
  setError(error) // display directly to user
}
```

---

## Pattern 8: Graceful Email Failure (Reliability)

**NFR addressed**: NFR-5.3, BR-11 (anti-enumeration)

**Problem**: Resend API failures on forgot-password must not reveal whether the email exists or break the anti-enumeration guarantee.

**Pattern**: Fire-and-forget with silent server-side error logging

**Design**:
```
POST /api/auth/forgot-password
  |
  |-- Always return 200 immediately after lookup phase
  |
  |-- If manager found:
  |     |-- Generate token, store hash
  |     |-- try { await resend.emails.send(...) }
  |     |   catch (e) { console.error('Email send failed:', e) }
  |                     ↑ logged server-side, NOT returned to client
  |
  v
Client always sees: "If an account exists for this email, a reset link has been sent."
```

**Why silent**: Any variation in response (success vs email error) would leak whether the email exists. Consistent response is mandatory.
