# Logical Components — Unit 1: Foundation

**Date**: 2026-03-01
**Unit**: Unit 1 — Foundation

---

## Component Map

```
lib/
├── prisma.ts          → PrismaClient singleton
├── auth.ts            → JWT utilities (sign, verify)
├── password.ts        → bcrypt utilities (hash, compare)
├── cookies.ts         → Cookie helpers (set session, clear session)
├── email.ts           → Resend wrapper (send password reset)
└── withAuth.ts        → Auth guard HOC

pages/api/auth/
├── register.ts        → Registration handler
├── login.ts           → Login handler
├── logout.ts          → Logout handler
├── forgot-password.ts → Forgot password handler
└── reset-password.ts  → Reset password handler

pages/api/jobs/
└── process-analysis.ts → Cron scaffold (CRON_SECRET guard only)

middleware/
└── (session variable injection done inside each API route transaction)
```

---

## LC-01: PrismaClient Singleton (`lib/prisma.ts`)

**Purpose**: Provides a single, reused Prisma database client instance across the application.

**NFR patterns**: Prisma Client Singleton (Pattern 6)

**Responsibilities**:
- Instantiate `PrismaClient` once per process
- Attach to `globalThis` in development to survive hot reloads
- Configure query logging (verbose in dev, errors only in prod)
- Export `prisma` as the single DB access point for all API routes

**Interface**:
```typescript
export const prisma: PrismaClient
```

**Dependencies**: `@prisma/client`, environment variable `DATABASE_URL`

---

## LC-02: JWT Utilities (`lib/auth.ts`)

**Purpose**: Encapsulates all JWT creation and verification logic in one place.

**NFR patterns**: Stateless Session (Pattern 1), Middleware Auth Guard (Pattern 2)

**Responsibilities**:
- Sign a JWT with `{ managerId, email }` payload and 24h expiry
- Verify and decode a JWT from an incoming request cookie
- Extract `managerId` from a verified token

**Interface**:
```typescript
interface SessionPayload {
  managerId: string
  email: string
}

// Sign a new session token
export async function signSessionToken(payload: SessionPayload): Promise<string>

// Verify token; throws on invalid/expired
export async function verifySessionToken(token: string): Promise<SessionPayload>
```

**Dependencies**: `jose`, environment variable `SECRET_KEY`

**Error behaviour**:
- `verifySessionToken` throws `JWTExpired` or `JWTInvalid` (from `jose`) — callers handle these to redirect to login

---

## LC-03: Password Utilities (`lib/password.ts`)

**Purpose**: Encapsulates bcrypt hashing and comparison.

**NFR patterns**: Timing-Safe Credential Verification (Pattern 4)

**Responsibilities**:
- Hash a plain-text password using bcrypt (cost 12)
- Compare an input password against a stored hash (timing-safe)
- Export the `DUMMY_HASH` constant for anti-enumeration on login

**Interface**:
```typescript
// Hash a plain-text password (cost 12)
export async function hashPassword(password: string): Promise<string>

// Constant-time comparison
export async function verifyPassword(password: string, hash: string): Promise<boolean>

// Pre-computed hash for anti-enumeration (used when email not found)
export const DUMMY_HASH: string
```

**Dependencies**: `bcryptjs`

---

## LC-04: Cookie Utilities (`lib/cookies.ts`)

**Purpose**: Provides helpers to set and clear the session cookie with correct security flags.

**NFR patterns**: Stateless Session (Pattern 1)

**Responsibilities**:
- Set the `session` cookie on a `NextApiResponse` with all required flags
- Clear the `session` cookie (set to expired) on logout

**Interface**:
```typescript
// Set session cookie with httpOnly, Secure (prod), SameSite=Lax
export function setSessionCookie(res: NextApiResponse, token: string): void

// Clear session cookie by setting Max-Age=0
export function clearSessionCookie(res: NextApiResponse): void
```

**Cookie properties applied**:
```typescript
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  // No maxAge — JWT exp is authoritative; cookie cleared on browser close or explicit logout
}
```

**Dependencies**: `next` (`NextApiResponse`)

---

## LC-05: Email Utility (`lib/email.ts`)

**Purpose**: Wraps the Resend API for sending transactional emails. Unit 1 uses only password reset email.

**NFR patterns**: Graceful Email Failure (Pattern 8)

**Responsibilities**:
- Send password reset email with the reset link
- Isolate Resend API details from API route handlers

**Interface**:
```typescript
// Send password reset link; throws on Resend API error (caller should catch silently)
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void>
```

**Email content**:
- Subject: "Reset your 1:1OS password"
- Body: Plain link with 60-minute expiry notice
- From: `noreply@<configured-domain>` (set via `NEXT_PUBLIC_APP_URL` or hardcoded for PoC)

**Dependencies**: `resend`, environment variable `RESEND_API_KEY`

---

## LC-06: Auth Guard HOC (`lib/withAuth.ts`)

**Purpose**: Wraps protected Next.js pages to enforce server-side session validation and redirect unauthenticated users.

**NFR patterns**: Middleware Auth Guard (Pattern 2), Defense-in-Depth Data Isolation (Pattern 3)

**Responsibilities**:
- Extract the `session` cookie from the incoming request
- Verify the JWT using `verifySessionToken`
- On failure: return server-side redirect to `/auth/login`
- On success: inject `managerId` into page props
- Compose with any existing `getServerSideProps` on the wrapped page

**Interface**:
```typescript
export function withAuth<P extends { managerId: string }>(
  Page: NextPage<P>,
  getServerSidePropsInner?: (
    ctx: GetServerSidePropsContext,
    managerId: string
  ) => Promise<{ props: Omit<P, 'managerId'> }>
): NextPage<P>
```

**Redirect behaviour**:
- Missing cookie → redirect `/auth/login`
- Invalid JWT → redirect `/auth/login`
- Expired JWT → redirect `/auth/login` (jwt expiry handled by `jose`)

**Dependencies**: LC-02 (JWT utilities), `next`

---

## LC-07: API Error Handler (`lib/apiError.ts`)

**Purpose**: Utility to produce consistent JSON error responses from API routes.

**NFR patterns**: Consistent API Error Shape (Pattern 7)

**Responsibilities**:
- Centralize HTTP status + error message response writing
- Prevent stack traces or internal detail from reaching the client

**Interface**:
```typescript
export function sendError(
  res: NextApiResponse,
  status: 400 | 401 | 404 | 409 | 500,
  message: string
): void

// Standard 500 message — never exposes internals
export const INTERNAL_ERROR = 'Something went wrong. Please try again.'
```

**Usage in API routes**:
```typescript
catch (error) {
  console.error('[route]', error)
  return sendError(res, 500, INTERNAL_ERROR)
}
```

**Dependencies**: `next` (`NextApiResponse`)

---

## LC-08: Cron Auth Guard (inline in `/pages/api/jobs/process-analysis.ts`)

**Purpose**: Validates the `CRON_SECRET` header on the Vercel cron endpoint. Not extracted to a shared utility (single-use in Unit 1; may be refactored in Unit 3).

**NFR patterns**: Security — cron endpoint protection

**Responsibilities**:
- Compare `Authorization` header value against `process.env.CRON_SECRET`
- Return `401` on mismatch; proceed to handler on match

**Interface**: Inline check at the top of the route handler:
```typescript
const cronSecret = req.headers['authorization']
if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).json({ error: 'Unauthorized' })
}
```

**Dependencies**: environment variable `CRON_SECRET`

---

## Component Dependency Matrix

| Component | Depends On | Used By |
|-----------|-----------|---------|
| LC-01 PrismaClient | `@prisma/client`, `DATABASE_URL` | All API route handlers |
| LC-02 JWT Utils | `jose`, `SECRET_KEY` | LC-06 withAuth, login/register handlers |
| LC-03 Password Utils | `bcryptjs` | register handler, login handler |
| LC-04 Cookie Utils | `next` | login/register handlers, LC-06 withAuth |
| LC-05 Email Utility | `resend`, `RESEND_API_KEY` | forgot-password handler |
| LC-06 withAuth HOC | LC-02 JWT Utils, LC-04 Cookies | All protected pages |
| LC-07 API Error Handler | `next` | All API route handlers |
| LC-08 Cron Auth Guard | `CRON_SECRET` | `/api/jobs/process-analysis` |

---

## Data Flow: Auth Components (Registration)

```
RegisterPage (browser)
  |
  POST /api/auth/register
  |
  pages/api/auth/register.ts
    |-- LC-07: validate input (email format, password length)
    |-- LC-01: prisma.manager.findUnique({ where: { email } })
    |-- LC-07: sendError(409) if email exists
    |-- LC-03: hashPassword(password)
    |-- LC-01: prisma.manager.create(...)
    |-- LC-02: signSessionToken({ managerId, email })
    |-- LC-04: setSessionCookie(res, token)
    |-- res.status(200).json({ managerId })
```

## Data Flow: Auth Components (Protected Page Request)

```
Browser requests /dashboard (with session cookie)
  |
  withAuth(DashboardPage).getServerSideProps(ctx)
    |-- Extract cookie: ctx.req.cookies.session
    |-- LC-02: verifySessionToken(token)
    |     |-- Valid   → { managerId }
    |     |-- Invalid → redirect /auth/login
    |
    |-- return { props: { managerId } }
  |
DashboardPage renders with managerId
```
