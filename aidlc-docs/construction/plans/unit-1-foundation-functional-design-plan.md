# Functional Design Plan — Unit 1: Foundation

## Unit Scope (from unit-of-work.md)
- Stories: US-01 (Sign up), US-02 (Login/logout/session), US-16 (Forgot/reset password)
- Components: AuthComponent, DatabaseService (full schema), session middleware, Vercel cron scaffold, base layout

---

## Part 1: Clarifying Questions

Two design decisions needed before generating functional design artifacts.

---

### Question 1
How should teammate profile fields be stored in the database?
(Profile fields: role, strengths, growth areas, aspirations, KPIs, behavioral tendencies, feedback style, motivation drivers, recent performance notes)

A) **JSON column** — single `profile JSONB` column on the Teammate table. Flexible for AI-generated content, easy to update fields without schema migrations. Less queryable.
B) **Individual columns** — one column per profile field (e.g., `strengths TEXT`, `growth_areas TEXT`, etc.). More explicit schema, easier to query specific fields.
C) Other (please describe after [Answer]: tag below)

[Answer]:A

---

### Question 2
How should multi-user data isolation be enforced?

A) **Application-level** — Prisma queries always include `WHERE managerId = ?`. Simple, no Supabase-specific config needed. Isolation enforced in code.
B) **Supabase Row Level Security (RLS)** — PostgreSQL-level policies that automatically filter rows by the authenticated manager's ID. Defense-in-depth: even direct DB queries are scoped.
C) **Both** — RLS as the primary defense + application-level `managerId` checks as a secondary safeguard.
D) Other (please describe after [Answer]: tag below)

[Answer]:B

---

## Part 2: Generation Execution Plan

*Executes after answers received.*

### Step 1: Domain Entities
- [x] Generate `domain-entities.md`
  - [x] Manager entity (id, email, passwordHash, createdAt)
  - [x] Teammate entity (id, managerId, name, role, profile)
  - [x] Meeting entity (id, managerId, teammateId, rawText, source, status, themes, tags, summary, createdAt)
  - [x] Pattern entity (id, teammateId, description, severity, evidence, detectedAt)
  - [x] Commitment entity (id, managerId, teammateId, meetingId?, text, owner, status, dueDate, carryCount)
  - [x] AnalysisJob entity (id, meetingId, status, error, createdAt, processedAt)
  - [x] PushSubscription entity (id, managerId, subscription JSON, createdAt)
  - [x] PasswordResetToken entity (id, managerId, tokenHash, expiresAt, usedAt?)
  - [x] Entity relationships + full Prisma schema

### Step 2: Business Logic Model
- [x] Generate `business-logic-model.md`
  - [x] Registration flow (hash password → create manager → create session)
  - [x] Login flow (verify password → create JWT session)
  - [x] Session validation (verify JWT → extract managerId → attach to request)
  - [x] Logout flow (invalidate session)
  - [x] Forgot password flow (generate token → hash → store → send email)
  - [x] Reset password flow (validate token: not expired + not used → update password hash → mark token used)

### Step 3: Business Rules
- [x] Generate `business-rules.md`
  - [x] Password minimum length: 8 characters
  - [x] Email uniqueness constraint
  - [x] Session expiry: 24 hours of inactivity
  - [x] Reset token TTL: 60 minutes
  - [x] Reset token: single-use (marked used immediately on consumption)
  - [x] No email enumeration: forgot-password always returns success
  - [x] managerId isolation: every DB query scoped to authenticated manager
  - [x] Carry-forward counter rules for commitments

### Step 4: Frontend Components
- [x] Generate `frontend-components.md`
  - [x] Page components: LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, DashboardPage (shell)
  - [x] Form components: AuthForm (shared), PasswordInput (show/hide toggle)
  - [x] Layout: AppLayout (navbar, manager session indicator, logout)
  - [x] Middleware: withAuth HOC (redirects to /auth/login if no session)
  - [x] State: session stored in httpOnly cookie via Next.js API route
