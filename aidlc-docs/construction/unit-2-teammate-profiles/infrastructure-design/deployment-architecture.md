# Deployment Architecture — Unit 2: Teammate Profiles

**Date**: 2026-03-01
**Unit**: Unit 2: Teammate Profiles

---

## Component-to-Service Mapping

| Logical Component | Code Location | Deployed As | Service |
|------------------|--------------|-------------|---------|
| Teammate CRUD routes | `pages/api/teammates/` | Serverless function | Vercel |
| Interview next-question route | `pages/api/interviews/[id]/next.ts` | Serverless function (30s) | Vercel |
| Interview complete route | `pages/api/interviews/[id]/complete.ts` | Serverless function (30s) | Vercel |
| InterviewAIHandler | `handlers/interviewAIHandler.ts` | Module within serverless function | Vercel |
| TeammateService | `lib/teammates.ts` | Module within serverless function | Vercel |
| Dashboard page (SSR) | `pages/index.tsx` | SSR serverless function | Vercel |
| Interview page (SSR) | `pages/teammates/[id]/interview.tsx` | SSR serverless function | Vercel |
| Profile page (SSR) | `pages/teammates/[id]/index.tsx` | SSR serverless function | Vercel |
| React UI components | `components/teammates/`, `components/interview/` | Static JS bundle | Vercel CDN |
| teammates table | `prisma/schema.prisma` | PostgreSQL table | Supabase |
| Claude Haiku | External | Managed AI API | Anthropic |
| Claude Sonnet | External | Managed AI API | Anthropic |

---

## Request Flow Diagrams

### Flow 1: List Teammates (Dashboard)

```
Browser
  │  GET /  (page request)
  ▼
Vercel SSR Function
  │  withAuth → verify JWT session cookie
  │  managerId extracted
  │
  │  TeammateService.listTeammates(managerId)
  │    → SELECT * FROM teammates WHERE managerId = ? ORDER BY name
  ▼
Supabase PostgreSQL
  │
  ▼
Vercel SSR Function
  │  countPopulatedFields() for each teammate
  │  Render HTML with teammate list
  ▼
Browser
  Hydrated React page
  TeammateList + TeammateCard components rendered
```

---

### Flow 2: Create Teammate + Navigate to Interview

```
Browser
  │  POST /api/teammates
  │  { name: "Chirag", role: "Senior Product Designer" }
  ▼
Vercel Serverless Function (10s limit)
  │  withAuth → managerId
  │  Validate name + role
  │  TeammateService.createTeammate(managerId, name, role)
  │    → INSERT INTO teammates (managerId, name, role, profile)
  │      VALUES (?, ?, ?, NULL)
  ▼
Supabase PostgreSQL
  │
  ▼
Vercel Serverless Function
  │  Return { id, name, role, createdAt }
  ▼
Browser
  │  Navigate to /teammates/[id]/interview
  │  GET /teammates/[id]/interview (SSR page)
  │    → loads teammate name + role via getServerSideProps
  │  InterviewChatPage mounts → state: LOADING_FIRST_QUESTION
  │  POST /api/interviews/[id]/next (empty history)
```

---

### Flow 3: Interview Next Question

```
Browser
  │  POST /api/interviews/[id]/next
  │  { conversationHistory: [...], latestAnswer: "..." }
  ▼
Vercel Serverless Function (30s limit)
  │  withAuth → managerId
  │  Validate body shape
  │  TeammateService.getTeammate(managerId, teammateId) → ownership check
  │  interviewAIHandler.nextQuestion(...)
  │    → sanitizeAnswer(latestAnswer)
  │    → buildNextQuestionPrompt(history, latestAnswer, nextArea)
  │    → callClaudeWithRetry(fn, retries=1, delay=1000)
  │          │
  │          │ POST https://api.anthropic.com/v1/messages
  │          │ model: claude-haiku-4-5-20251001
  │          │ max_tokens: 300
  ▼          │
Anthropic Claude API
  │          │ ~1-3s response
  ▼          │
Vercel Serverless Function
  │  Extract question text from response
  │  Return { question, questionIndex, area, isComplete }
  ▼
Browser
  │  Append answered turn to turns[]
  │  Display new question (state: AWAITING_ANSWER)
  │  ...repeat for each of 7 questions...
```

---

### Flow 4: Profile Synthesis

```
Browser
  │  POST /api/interviews/[id]/complete
  │  { conversationHistory: [7 turns with answers] }
  ▼
Vercel Serverless Function (30s limit)
  │  withAuth → managerId
  │  Validate history.length === 7
  │  interviewAIHandler.generateProfile(...)
  │    → buildSynthesisPrompt(history)
  │    → callClaudeWithRetry(fn, retries=1, delay=1000)
  │          │
  │          │ POST https://api.anthropic.com/v1/messages
  │          │ model: claude-sonnet-4-6
  │          │ max_tokens: 1024
  ▼          │
Anthropic Claude API
  │          │ ~8-15s response
  ▼          │
Vercel Serverless Function
  │  parseProfileJSON(responseText)
  │    → JSON.parse() or regex extraction
  │  TeammateService.updateTeammate(managerId, id, { profile: ProfileFields })
  │    → UPDATE teammates SET profile = ? WHERE id = ? AND managerId = ?
  ▼
Supabase PostgreSQL
  │
  ▼
Vercel Serverless Function
  │  Return { profile: ProfileFields }
  ▼
Browser
  │  state → COMPLETE
  │  Navigate to /teammates/[id]
```

---

### Flow 5: Claude Failure Fallback

```
Browser
  │  POST /api/interviews/[id]/next  (or /complete)
  ▼
Vercel Serverless Function (30s limit)
  │  callClaudeWithRetry(fn)
  │    → fn() throws (5xx / 529 / network)
  │    → wait 1000ms
  │    → fn() throws again
  │    → re-throw error
  │  Route handler catches error
  │  Return HTTP 503
  │  { fallback: true,
  │    message: "AI interview unavailable. You can fill in the profile manually." }
  ▼
Browser
  │  Detect { fallback: true }
  │  state → FALLBACK
  │  Navigate to /teammates/[id]?editMode=1
  ▼
Vercel SSR Function (Profile Page)
  │  GET /teammates/[id] with ?editMode=1
  │  getServerSideProps loads teammate (profile: null)
  │  Page renders in edit mode (all fields empty)
  ▼
Browser
  │  Manager fills profile manually
  │  PATCH /api/teammates/[id] → profile saved
```

---

### Flow 6: Edit Profile

```
Browser
  │  GET /teammates/[id]  (SSR page)
  ▼
Vercel SSR Function
  │  withAuth → managerId
  │  TeammateService.getTeammate(managerId, id)
  │    → SELECT * FROM teammates WHERE id = ? AND managerId = ?
  ▼
Supabase PostgreSQL → returns teammate with profile JSON
  │
  ▼
Vercel SSR Function
  │  countPopulatedFields(role, profile) → profileCompleteness
  │  Render HTML (profile view or edit mode if ?editMode=1)
  ▼
Browser
  │  Click "Edit Profile" → edit mode activates
  │  Manager edits fields
  │  Click "Save"
  │  PATCH /api/teammates/[id]
  │  { profile: { strengths: "...", growthAreas: "..." } }
  ▼
Vercel Serverless Function (10s limit)
  │  withAuth → managerId
  │  Validate name/role if present
  │  TeammateService.updateTeammate(...)
  │    → fetch existing profile
  │    → merge new values into existing JSONB
  │    → UPDATE teammates SET profile = merged WHERE id = ? AND managerId = ?
  ▼
Supabase PostgreSQL
  │
  ▼
Browser
  │  Toast: "Profile saved."
  │  Edit mode deactivates
```

---

## Environment Architecture

```
┌─────────────────────────────────────────────────┐
│  LOCAL DEVELOPMENT                              │
│                                                 │
│  npm run dev (Next.js dev server :3000)         │
│    ├── pages/ (hot reload)                      │
│    ├── handlers/ (module reload)                │
│    └── lib/ (module reload)                     │
│                                                 │
│  .env.local:                                    │
│    DATABASE_URL=postgresql://...                │
│    DIRECT_URL=postgresql://...                  │
│    SECRET_KEY=local-dev-secret...               │
│    RESEND_API_KEY=re_placeholder                │
│    CRON_SECRET=local-cron-secret                │
│    NEXT_PUBLIC_APP_URL=http://localhost:3000     │
│    ANTHROPIC_API_KEY=sk-ant-...  [NEW Unit 2]   │
│                                                 │
│  External calls:                                │
│    ├── Supabase PostgreSQL (dev project)        │
│    └── Anthropic Claude API (real calls)        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  PRODUCTION (Vercel)                            │
│                                                 │
│  Build: prisma generate && next build           │
│                                                 │
│  Vercel Environment Variables:                  │
│    DATABASE_URL      (Unit 1)                   │
│    DIRECT_URL        (Unit 1)                   │
│    SECRET_KEY        (Unit 1)                   │
│    RESEND_API_KEY    (Unit 1)                   │
│    CRON_SECRET       (Unit 1)                   │
│    NEXT_PUBLIC_APP_URL (Unit 1)                 │
│    ANTHROPIC_API_KEY  [NEW Unit 2]              │
│                                                 │
│  Serverless functions:                          │
│    /api/teammates/*         → 10s max           │
│    /api/interviews/*/next   → 30s max [NEW]     │
│    /api/interviews/*/complete → 30s max [NEW]   │
│    /api/auth/*              → 10s (Unit 1)      │
│    /api/jobs/*              → 10s (Unit 1)      │
│                                                 │
│  External calls:                                │
│    ├── Supabase PostgreSQL (prod project)       │
│    └── Anthropic Claude API                     │
└─────────────────────────────────────────────────┘
```

---

## Infrastructure Changes vs Unit 1

| Dimension | Unit 1 | Unit 2 Change |
|-----------|--------|---------------|
| Vercel functions | auth routes + cron | + 5 teammate CRUD routes + 2 interview routes |
| Function timeout | 10s (all routes) | + 30s on 2 interview routes |
| External services | Resend (email) | + Anthropic Claude API |
| Environment variables | 6 vars | + 1 (`ANTHROPIC_API_KEY`) |
| DB schema | Full schema migrated | No changes |
| DB migrations | Initial migration applied | None in Unit 2 |
| npm packages | Next.js, Prisma, jose, bcryptjs, Resend, Tailwind | + `@anthropic-ai/sdk` |

---

## Technical Debt Inherited + New

| ID | Item | Impact on Infrastructure |
|----|------|-------------------------|
| TD-01 | No rate limiting on API routes | Interview routes callable in rapid succession; Claude API costs uncapped |
| TD-06 | No prompt injection protection | Adversarial answers could manipulate Claude output; acceptable for private tool |
| TD-07 | Interview state lost on refresh | No infrastructure mitigation; would require IndexedDB or DB-backed session |
| TD-08 | No Claude API cost monitoring | No budget alerts or usage dashboard; add before public launch |
