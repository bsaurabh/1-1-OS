# Business Rules — Unit 1: Foundation

**Date**: 2026-03-01

---

## Rule Group 1: Authentication — Registration

### BR-01: Email Format Validation
- Email must conform to RFC 5322 format
- Validation performed server-side before any DB lookup
- Client-side validation is supplementary (not trusted)
- **Error message**: "Please enter a valid email address."

### BR-02: Email Uniqueness
- Email must be unique across all Manager records
- Check is case-insensitive (store email as lowercase)
- **Error message**: "An account with this email already exists."
- Check occurs BEFORE password hashing (fail fast)

### BR-03: Password Minimum Length
- Minimum password length: **8 characters**
- No maximum length imposed (bcrypt truncates at 72 bytes — acceptable)
- No complexity requirements at this stage (MVP simplicity)
- Validation performed on raw password BEFORE hashing
- **Error message**: "Password must be at least 8 characters."

### BR-04: Password Hashing
- Algorithm: **bcrypt**
- Cost factor: **12**
- Plain-text password MUST NEVER be stored, logged, or returned
- Hash stored in `Manager.passwordHash` column only

---

## Rule Group 2: Authentication — Login

### BR-05: No Email Enumeration on Login
- Login error message is identical regardless of whether email exists or password is wrong
- **Error message**: "Incorrect email or password." (always)
- Timing: bcrypt.compare must run even for non-existent accounts (use dummy hash) to prevent timing-based enumeration

### BR-06: Password Comparison
- Use `bcrypt.compare(inputPassword, storedHash)` — no custom comparison
- Comparison is constant-time (bcrypt guarantee)

---

## Rule Group 3: Session Management

### BR-07: Session Token Format
- Token type: **JWT (JSON Web Token)**
- Payload: `{ managerId: string, email: string, exp: number }`
- Signed with `SECRET_KEY` environment variable (HS256)
- Token expiry: **now + 24 hours**

### BR-08: Session Cookie Properties
- Cookie name: `session`
- Flags: `httpOnly: true`, `Secure: true`, `SameSite: Lax`
- `httpOnly`: prevents JavaScript access (XSS protection)
- `Secure`: HTTPS only (enforced in production; allowed on localhost)
- `SameSite=Lax`: CSRF protection while allowing top-level navigations
- No explicit `Max-Age` (session cookie — expires on browser close), but JWT exp enforces server-side expiry

### BR-09: Session Expiry Handling
- On expiry: clear cookie + redirect to `/auth/login`
- Message shown: "Your session has expired. Please log in again."
- Expiry checked on EVERY protected request via middleware

### BR-10: Manager ID Propagation to Database
- On every authenticated DB transaction, set: `SET LOCAL app.manager_id = '<managerId>'`
- This enables Supabase RLS to scope all queries to the authenticated manager
- Must be set within the same transaction that reads/writes data
- NEVER skip this — failure leaves RLS with empty manager_id, blocking all queries

---

## Rule Group 4: Password Reset

### BR-11: Forgot Password Anti-Enumeration
- The forgot-password endpoint ALWAYS returns the same success message regardless of whether the email exists
- **Message**: "If an account exists for this email, a reset link has been sent."
- No additional information is returned (no timing differences exploitable)

### BR-12: Reset Token Generation
- Token: **32 bytes** from `crypto.randomBytes(32)`, encoded as hex string
- Raw token sent in email; only the SHA-256 hash is stored in the database
- If raw token is compromised in transit, the stored hash is not exploitable directly

### BR-13: Reset Token Storage
- Stored as SHA-256 hash in `PasswordResetToken.tokenHash`
- `tokenHash` has a UNIQUE constraint — no two identical tokens can exist
- Associated with `managerId` for scope validation

### BR-14: Reset Token Expiry
- TTL: **60 minutes** from creation (`expiresAt = now() + 60 minutes`)
- **Error message on expiry**: "This link has expired. Please request a new one."

### BR-15: Reset Token Single-Use Enforcement
- `usedAt` is set IMMEDIATELY when token is first consumed (before password update)
- This is an atomic update to prevent race conditions on double-submission
- If `usedAt IS NOT NULL`: token is already used
- **Error message on reuse**: "This link is no longer valid."
- Order of checks: tokenHash lookup → usedAt check → expiresAt check → mark used → update password

### BR-16: Password Reset — New Password Rules
- New password subject to same rules as registration: minimum **8 characters**
- **Error message**: "Password must be at least 8 characters."

### BR-17: Session Invalidation After Reset
- After successful password reset, all existing sessions for the manager are effectively invalidated
- Implementation: the JWT secret is not rotated per-user (stateless tokens), so "invalidation" is client-side
- Response instructs: "Password updated. Please log in."
- Manager is redirected to `/auth/login` to create a new session

---

## Rule Group 5: Data Isolation (Multi-Tenancy)

### BR-18: Manager Scoping — Mandatory
- Every database query affecting user data MUST be scoped to the authenticated `managerId`
- Enforced at two levels:
  1. **Supabase RLS** (primary): PostgreSQL-level `current_setting('app.manager_id')` policy
  2. **Application-level `managerId` in Prisma queries** (secondary safeguard for clarity)

### BR-19: RLS Always Active
- RLS is ENABLED on all tables: `managers`, `teammates`, `meetings`, `patterns`, `commitments`, `analysis_jobs`, `push_subscriptions`, `password_reset_tokens`
- No table may be read or written without an active RLS policy matching the request
- Cron job operations that require bypass must use the Supabase service role key (not user session)

### BR-20: Cron Job Authorization
- The cron endpoint `GET /api/jobs/process-analysis` is NOT authenticated via session
- Protected by `CRON_SECRET` header (Vercel-provided)
- Header value compared against `process.env.CRON_SECRET`
- **On mismatch**: return `401 Unauthorized`
- Cron uses Supabase service role key (bypasses RLS) — Unit 3 implementation

---

## Rule Group 6: Commitment Carry-Forward (Referenced in Unit 1 Schema)

### BR-21: Carry-Forward Counter
- `Commitment.carryCount` starts at `0`
- Incremented by 1 each time commitment status transitions to `CARRIED_FORWARD`
- No maximum enforced (tracking only; UI may flag high carryCount values in later units)
- Reset is NOT allowed once incremented (audit trail integrity)

### BR-22: Commitment Status Transitions
Valid transitions:
```
SUGGESTED → OPEN
SUGGESTED → DROPPED
OPEN → DONE
OPEN → CARRIED_FORWARD
OPEN → DROPPED
CARRIED_FORWARD → OPEN
CARRIED_FORWARD → DONE
CARRIED_FORWARD → DROPPED
```
Invalid transitions (blocked at application layer):
- `DONE → any`
- `DROPPED → any`
- Any backward transition from terminal states

---

## Rule Group 7: General Data Rules

### BR-23: Primary Key Format
- All entity IDs use `cuid()` (collision-resistant unique IDs)
- Never expose sequential integer IDs to clients (prevents enumeration attacks)

### BR-24: Timestamps
- `createdAt`: set by database default (`now()`) — not settable by client
- `updatedAt`: auto-updated by Prisma on every write (`@updatedAt`)
- All timestamps stored in UTC

### BR-25: Soft Deletes — Not Used in Unit 1
- Unit 1 entities use hard deletes with CASCADE
- `Manager` deletion cascades to all child records (Teammate → Meeting → Pattern/Commitment/AnalysisJob)
- This is appropriate for MVP; soft delete can be added in later units if needed
