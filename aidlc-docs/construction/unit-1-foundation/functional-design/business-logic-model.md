# Business Logic Model — Unit 1: Foundation

**Date**: 2026-03-01

---

## Flow 1: Registration (US-01)

```
Input: email (string), password (string)

1. Validate email format (RFC 5322 pattern)
2. Validate password length >= 8 characters
3. Check email uniqueness in managers table
   - IF exists → return error: "An account with this email already exists."
4. Hash password using bcrypt (cost factor: 12)
5. Insert Manager record { email, passwordHash }
6. Create JWT session token { managerId, email, exp: now + 24h }
7. Set session cookie (httpOnly, Secure, SameSite=Lax)
8. Return { managerId }
9. Redirect to onboarding / dashboard
```

---

## Flow 2: Login (US-02)

```
Input: email (string), password (string)

1. Lookup manager by email
   - IF not found → return error: "Incorrect email or password." (no enumeration)
2. Compare input password against stored passwordHash using bcrypt.compare()
   - IF mismatch → return error: "Incorrect email or password."
3. Create JWT session token { managerId, email, exp: now + 24h }
4. Set session cookie (httpOnly, Secure, SameSite=Lax)
5. Return { managerId }
6. Redirect to dashboard
```

---

## Flow 3: Session Validation (middleware — all protected routes)

```
Input: request with session cookie

1. Extract session JWT from cookie
   - IF missing → redirect to /auth/login
2. Verify JWT signature using SECRET_KEY
   - IF invalid signature → redirect to /auth/login
3. Check token expiry (exp claim)
   - IF expired → clear cookie, redirect to /auth/login with "session expired" message
4. Extract { managerId } from token payload
5. Attach managerId to request context
6. Set DB transaction variable: SET LOCAL app.manager_id = '<managerId>'
7. Pass request to handler
```

---

## Flow 4: Logout (US-02)

```
Input: authenticated request

1. Clear session cookie (set to expired)
2. Return 200
3. Redirect to /auth/login
```

---

## Flow 5: Forgot Password (US-16)

```
Input: email (string)

1. Always return success message (prevent email enumeration)
   Message: "If an account exists for this email, a reset link has been sent."
2. Lookup manager by email
   - IF not found → return success (no further action — anti-enumeration)
3. Generate cryptographically secure random token (32 bytes, crypto.randomBytes)
4. Hash token using SHA-256 (store hash, send raw token in email)
5. Set expiresAt = now() + 60 minutes
6. Insert PasswordResetToken { managerId, tokenHash, expiresAt }
7. Construct reset URL: https://<domain>/auth/reset-password?token=<rawToken>
8. Send email via EmailService with reset URL
9. Return success
```

---

## Flow 6: Reset Password (US-16)

```
Input: token (string), newPassword (string)

1. Validate newPassword length >= 8 characters
2. Hash input token using SHA-256
3. Lookup PasswordResetToken by tokenHash
   - IF not found → return error: "This link is no longer valid."
4. Check usedAt
   - IF usedAt is not null → return error: "This link is no longer valid."
5. Check expiresAt
   - IF expiresAt < now() → return error: "This link has expired. Please request a new one."
6. Mark token as used: SET usedAt = now() (atomic — prevents race conditions)
7. Hash newPassword using bcrypt (cost factor: 12)
8. Update Manager.passwordHash
9. Invalidate any active sessions for this manager (clear cookies client-side)
10. Return success: "Password updated. Please log in."
11. Redirect to /auth/login
```

---

## Flow 7: Vercel Cron Scaffold (AnalysisJobQueue)

```
Endpoint: GET /api/jobs/process-analysis
Trigger: Vercel cron every 30 seconds
Auth: Protected by CRON_SECRET header (Vercel-provided)

Unit 1 implementation (scaffold only):
1. Verify CRON_SECRET header matches env variable
   - IF mismatch → return 401
2. Log "Cron job triggered"
3. Return 200 { processed: 0 }
   (Full implementation wired in Unit 3)
```
