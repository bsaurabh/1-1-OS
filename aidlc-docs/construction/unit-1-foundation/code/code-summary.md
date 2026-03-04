# Code Summary — Unit 1: Foundation

**Date**: 2026-03-01
**Status**: Complete

---

## File Inventory

### Configuration (workspace root)
| File | Purpose |
|------|---------|
| `package.json` | npm dependencies and scripts |
| `tsconfig.json` | TypeScript strict mode config |
| `next.config.js` | Next.js config |
| `tailwind.config.js` | Tailwind CSS config |
| `postcss.config.js` | PostCSS config |
| `.gitignore` | Ignores node_modules, .env.local, .next |
| `vercel.json` | Cron job definition (hourly schedule) |
| `jest.config.ts` | Jest config with ts-jest and path aliases |

### Database
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Full schema — 8 models, 7 enums |
| `prisma/migrations/20260301000000_init/migration.sql` | Initial migration + RLS policies |

### Library Utilities (`lib/`)
| File | Exports | Purpose |
|------|---------|---------|
| `lib/prisma.ts` | `prisma` | PrismaClient singleton |
| `lib/apiError.ts` | `sendError`, `INTERNAL_ERROR` | Consistent error responses |
| `lib/password.ts` | `hashPassword`, `verifyPassword`, `DUMMY_HASH` | bcrypt utilities |
| `lib/auth.ts` | `signSessionToken`, `verifySessionToken`, `SessionPayload` | JWT utilities |
| `lib/cookies.ts` | `setSessionCookie`, `clearSessionCookie` | Cookie helpers |
| `lib/email.ts` | `sendPasswordResetEmail` | Resend wrapper |
| `lib/withAuth.ts` | `withAuth`, `WithAuthProps` | Auth guard HOC |

### API Routes (`pages/api/`)
| File | Method | Stories |
|------|--------|---------|
| `pages/api/auth/register.ts` | POST | US-01 |
| `pages/api/auth/login.ts` | POST | US-02 |
| `pages/api/auth/logout.ts` | POST | US-02 |
| `pages/api/auth/forgot-password.ts` | POST | US-16 |
| `pages/api/auth/reset-password.ts` | POST | US-16 |
| `pages/api/jobs/process-analysis.ts` | GET (cron) | Unit 3 scaffold |

### Frontend Components (`components/`)
| File | Purpose |
|------|---------|
| `components/auth/PasswordInput.tsx` | Password field with show/hide toggle |
| `components/auth/AuthForm.tsx` | Shared form wrapper |
| `components/layout/AppLayout.tsx` | Navbar + main layout |

### Pages (`pages/`)
| File | Auth Required | Stories |
|------|--------------|---------|
| `pages/_app.tsx` | No | Foundation |
| `pages/index.tsx` | Redirect | Foundation |
| `pages/auth/login.tsx` | No (redirect if authed) | US-02 |
| `pages/auth/register.tsx` | No (redirect if authed) | US-01 |
| `pages/auth/forgot-password.tsx` | No | US-16 |
| `pages/auth/reset-password.tsx` | No | US-16 |
| `pages/dashboard/index.tsx` | Yes (withAuth) | US-02 |

### Styles
| File | Purpose |
|------|---------|
| `styles/globals.css` | Tailwind CSS directives |

### Tests (`__tests__/`)
| File | Coverage |
|------|---------|
| `__tests__/lib/password.test.ts` | hashPassword, verifyPassword, DUMMY_HASH |
| `__tests__/lib/auth.test.ts` | signSessionToken, verifySessionToken (valid/tampered/wrong-secret) |
| `__tests__/lib/cookies.test.ts` | setSessionCookie (flags), clearSessionCookie (Max-Age=0) |
| `__tests__/lib/apiError.test.ts` | sendError, INTERNAL_ERROR |
| `__tests__/api/register.test.ts` | Validation, 409 conflict, 200 success |
| `__tests__/api/login.test.ts` | DUMMY_HASH path, wrong password, 200 success |
| `__tests__/api/logout.test.ts` | Cookie cleared, 200 ok, 405 on GET |
| `__tests__/api/forgot-password.test.ts` | Always-200, email sent, silent email failure |
| `__tests__/api/reset-password.test.ts` | Invalid token, used token, expired, 200 success + atomic update |

---

## Story Coverage

| Story | Status | Files |
|-------|--------|-------|
| US-01: Sign up | ✅ Complete | register.ts, register.tsx, password.ts, auth.ts, cookies.ts |
| US-02: Login/logout/session | ✅ Complete | login.ts, logout.ts, login.tsx, withAuth.ts, dashboard/index.tsx, AppLayout.tsx |
| US-16: Forgot/reset password | ✅ Complete | forgot-password.ts, reset-password.ts, forgot-password.tsx, reset-password.tsx, email.ts |

---

## Key Implementation Notes

1. **DUMMY_HASH anti-enumeration**: Login always runs `bcrypt.compare` regardless of whether the email exists — prevents timing-based user enumeration.

2. **Forgot-password response ordering**: `res.json()` is called immediately (before DB/email work) to guarantee the anti-enumeration response even if downstream work fails.

3. **Atomic token consumption**: `passwordResetToken.update({ usedAt: new Date() })` runs before `manager.update({ passwordHash })` — ensures the token is consumed even if the password update fails.

4. **withAuth HOC**: Composes with inner `getServerSideProps` via second parameter. Dashboard page uses it to fetch `managerEmail` alongside the auth check.

5. **Vercel.json cron interval**: Set to hourly (`0 * * * *`) for Hobby tier. 30-second interval (from design) requires Vercel Pro — upgrade when needed in Unit 3.

6. **Prisma + PgBouncer**: `connection_limit=1` required in `DATABASE_URL`. `DIRECT_URL` used only for `prisma migrate deploy`.

---

## Interfaces Provided to Downstream Units

| Export | File | Used By |
|--------|------|---------|
| `prisma` | `lib/prisma.ts` | All units |
| `withAuth` / `WithAuthProps` | `lib/withAuth.ts` | Units 2–5 (all protected pages) |
| `AppLayout` | `components/layout/AppLayout.tsx` | Units 2–5 |
| Prisma schema (all 8 models) | `prisma/schema.prisma` | Units 2–5 (additive migrations) |
| `vercel.json` cron | `vercel.json` | Unit 3 (wires full implementation) |
