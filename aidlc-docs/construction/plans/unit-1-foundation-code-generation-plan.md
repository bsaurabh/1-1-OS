# Code Generation Plan — Unit 1: Foundation

**Date**: 2026-03-01
**Workspace root**: `/Users/saurabhbajaj/Desktop/testproject`
**Project type**: Greenfield — Next.js monolith (type-based folder structure)

---

## Unit Context

**Stories implemented**:
- US-01: Sign up for an account (register flow)
- US-02: Log in and log out (login, session expiry, logout)
- US-16: Reset a forgotten password (forgot-password + reset-password)

**Dependencies**: None (Unit 1 is the foundation — no upstream unit dependencies)

**Interfaces produced for downstream units**:
- `lib/prisma.ts` — PrismaClient singleton (used by all units)
- `lib/withAuth.ts` — Auth guard HOC (used by all protected pages in Units 2–5)
- `lib/auth.ts` — JWT utilities (used by session-aware API routes)
- Prisma schema with all 8 entities (extended by Units 2–5 via additive migrations)
- `vercel.json` — Cron scaffold (wired in Unit 3)

---

## Step-by-Step Generation Plan

---

### Step 1: Project Setup — Configuration Files
**Path**: workspace root
**Files**:
- [x] `package.json` — dependencies, scripts
- [x] `tsconfig.json` — TypeScript strict config
- [x] `next.config.js` — Next.js config
- [x] `tailwind.config.js` — Tailwind CSS config
- [x] `postcss.config.js` — PostCSS config
- [x] `.gitignore` — ignore `.env.local`, `node_modules`, `.next`
- [x] `vercel.json` — cron job definition

---

### Step 2: Prisma Schema
**Path**: `prisma/`
**Files**:
- [x] `prisma/schema.prisma` — full schema (all 8 entities from domain-entities.md)

---

### Step 3: Database Migration
**Path**: `prisma/migrations/`
**Files**:
- [x] `prisma/migrations/20260301000000_init/migration.sql` — initial migration SQL (schema + RLS policies)

---

### Step 4: Library — Prisma Client Singleton
**Path**: `lib/`
**Files**:
- [x] `lib/prisma.ts` — PrismaClient singleton with globalThis pattern
**Stories**: foundation for all DB access

---

### Step 5: Library — API Error Handler
**Path**: `lib/`
**Files**:
- [x] `lib/apiError.ts` — `sendError()` function + `INTERNAL_ERROR` constant
**Stories**: used by all API routes

---

### Step 6: Library — Password Utilities
**Path**: `lib/`
**Files**:
- [x] `lib/password.ts` — `hashPassword()`, `verifyPassword()`, `DUMMY_HASH`
**Stories**: US-01 (register), US-02 (login), US-16 (reset password)

---

### Step 7: Library — JWT Utilities
**Path**: `lib/`
**Files**:
- [x] `lib/auth.ts` — `signSessionToken()`, `verifySessionToken()`, `SessionPayload` type
**Stories**: US-01, US-02

---

### Step 8: Library — Cookie Utilities
**Path**: `lib/`
**Files**:
- [x] `lib/cookies.ts` — `setSessionCookie()`, `clearSessionCookie()`
**Stories**: US-01, US-02

---

### Step 9: Library — Email Utility
**Path**: `lib/`
**Files**:
- [x] `lib/email.ts` — `sendPasswordResetEmail()`
**Stories**: US-16

---

### Step 10: Library — Auth Guard HOC
**Path**: `lib/`
**Files**:
- [x] `lib/withAuth.ts` — `withAuth()` HOC wrapping `getServerSideProps`
**Stories**: US-02 (session validation on all protected pages)

---

### Step 11: API Route — Register
**Path**: `pages/api/auth/`
**Files**:
- [x] `pages/api/auth/register.ts` — POST handler: validate → check uniqueness → hash → insert → JWT → cookie
**Stories**: US-01

---

### Step 12: API Route — Login
**Path**: `pages/api/auth/`
**Files**:
- [x] `pages/api/auth/login.ts` — POST handler: lookup → DUMMY_HASH fallback → bcrypt.compare → JWT → cookie
**Stories**: US-02

---

### Step 13: API Route — Logout
**Path**: `pages/api/auth/`
**Files**:
- [x] `pages/api/auth/logout.ts` — POST handler: clearSessionCookie → 200
**Stories**: US-02

---

### Step 14: API Route — Forgot Password
**Path**: `pages/api/auth/`
**Files**:
- [x] `pages/api/auth/forgot-password.ts` — POST handler: always-success → lookup → token → hash → store → email (silent failure)
**Stories**: US-16

---

### Step 15: API Route — Reset Password
**Path**: `pages/api/auth/`
**Files**:
- [x] `pages/api/auth/reset-password.ts` — POST handler: validate → hash token → lookup → check usedAt → check expiry → atomic mark → bcrypt → update password
**Stories**: US-16

---

### Step 16: API Route — Cron Scaffold
**Path**: `pages/api/jobs/`
**Files**:
- [x] `pages/api/jobs/process-analysis.ts` — GET handler: CRON_SECRET guard → log → return { processed: 0 }
**Stories**: foundation for Unit 3 cron wiring

---

### Step 17: Frontend Components — PasswordInput
**Path**: `components/auth/`
**Files**:
- [x] `components/auth/PasswordInput.tsx` — password field with show/hide toggle, `data-testid` attributes
**Stories**: US-01, US-02, US-16

---

### Step 18: Frontend Components — AuthForm
**Path**: `components/auth/`
**Files**:
- [x] `components/auth/AuthForm.tsx` — shared form wrapper (title, children, error, submit button, loading state), `data-testid` attributes
**Stories**: US-01, US-02, US-16

---

### Step 19: Frontend Components — AppLayout
**Path**: `components/layout/`
**Files**:
- [x] `components/layout/AppLayout.tsx` — navbar (app name, manager email, logout button), main wrapper, `data-testid` attributes
**Stories**: US-02 (logout), foundation for all authenticated pages

---

### Step 20: Pages — Global App Shell
**Path**: `pages/`
**Files**:
- [x] `pages/_app.tsx` — global styles import, default export
- [x] `styles/globals.css` — Tailwind CSS directives
- [x] `pages/index.tsx` — root redirect (→ /dashboard or /auth/login via getServerSideProps)
**Stories**: foundation

---

### Step 21: Page — Login
**Path**: `pages/auth/`
**Files**:
- [x] `pages/auth/login.tsx` — LoginPage: controlled form, POST /api/auth/login, error display, redirect on success
**Stories**: US-02

---

### Step 22: Page — Register
**Path**: `pages/auth/`
**Files**:
- [x] `pages/auth/register.tsx` — RegisterPage: controlled form, client validation (email + min 8 chars), POST /api/auth/register
**Stories**: US-01

---

### Step 23: Page — Forgot Password
**Path**: `pages/auth/`
**Files**:
- [x] `pages/auth/forgot-password.tsx` — ForgotPasswordPage: email field, always-success UI after submit
**Stories**: US-16

---

### Step 24: Page — Reset Password
**Path**: `pages/auth/`
**Files**:
- [x] `pages/auth/reset-password.tsx` — ResetPasswordPage: token from query, new password field, POST /api/auth/reset-password, success/error states
**Stories**: US-16

---

### Step 25: Page — Dashboard Shell
**Path**: `pages/dashboard/`
**Files**:
- [x] `pages/dashboard/index.tsx` — DashboardPage: protected via withAuth, AppLayout, placeholder content
**Stories**: US-02 (session-protected landing page)

---

### Step 26: Unit Tests — Library Utilities
**Path**: `__tests__/lib/`
**Files**:
- [x] `__tests__/lib/password.test.ts` — hashPassword, verifyPassword, DUMMY_HASH tests
- [x] `__tests__/lib/auth.test.ts` — signSessionToken, verifySessionToken tests (valid, expired, tampered)
- [x] `__tests__/lib/cookies.test.ts` — setSessionCookie, clearSessionCookie flag tests
- [x] `__tests__/lib/apiError.test.ts` — sendError status + body tests
**Stories**: US-01, US-02, US-16 (unit coverage)

---

### Step 27: Unit Tests — API Routes
**Path**: `__tests__/api/`
**Files**:
- [x] `__tests__/api/register.test.ts` — validation errors, email conflict, success path
- [x] `__tests__/api/login.test.ts` — wrong email, wrong password (DUMMY_HASH path), success, sets cookie
- [x] `__tests__/api/logout.test.ts` — clears cookie, returns 200
- [x] `__tests__/api/forgot-password.test.ts` — always returns 200, email-not-found path, email-found path, email send failure (silent)
- [x] `__tests__/api/reset-password.test.ts` — invalid token, used token, expired token, success path
**Stories**: US-01, US-02, US-16

---

### Step 28: Jest Configuration
**Path**: workspace root
**Files**:
- [x] `jest.config.ts` — Jest config for Next.js (using `next/jest`)
- [x] `jest.setup.ts` — global test setup

---

### Step 29: Code Summary Documentation
**Path**: `aidlc-docs/construction/unit-1-foundation/code/`
**Files**:
- [x] `aidlc-docs/construction/unit-1-foundation/code/code-summary.md` — file inventory, story coverage matrix, notes

---

## Story Coverage Matrix

| Story | Steps Implementing It |
|-------|-----------------------|
| US-01 (Sign up) | Steps 6, 7, 8, 11, 17, 18, 22, 26, 27 |
| US-02 (Login/logout/session) | Steps 7, 8, 10, 12, 13, 17, 18, 19, 21, 25, 26, 27 |
| US-16 (Forgot/reset password) | Steps 6, 7, 9, 14, 15, 17, 18, 23, 24, 26, 27 |

---

## Total: 29 steps | ~40 files to create
