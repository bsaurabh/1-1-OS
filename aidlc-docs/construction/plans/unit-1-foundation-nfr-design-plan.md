# NFR Design Plan — Unit 1: Foundation

## Unit Scope
- Unit 1: Foundation — Auth, DB Schema, Session Middleware, Cron Scaffold, Base Layout

## Assessment
All NFR design decisions are fully derivable from the NFR Requirements and Functional Design artifacts. No clarifying questions are needed — proceeding directly to generation.

---

## Generation Execution Plan

### Step 1: NFR Design Patterns
- [x] Generate `nfr-design-patterns.md`
  - [x] Security patterns: stateless JWT, httpOnly cookie, middleware auth guard
  - [x] Performance patterns: SSR for auth pages, bcrypt timing, Prisma singleton
  - [x] Scalability patterns: stateless API, PgBouncer connection pooling
  - [x] Reliability patterns: consistent error handling, graceful degradation on email failure
  - [x] Maintainability patterns: environment separation, TypeScript strict mode

### Step 2: Logical Components
- [x] Generate `logical-components.md`
  - [x] Auth middleware component (withAuth HOC / session validation)
  - [x] JWT utility component (sign / verify)
  - [x] Password utility component (hash / compare)
  - [x] Cookie utility component (set / clear)
  - [x] Prisma client singleton
  - [x] Email utility component (Resend wrapper)
  - [x] API error handler utility
  - [x] Cron auth guard
