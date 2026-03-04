# Deployment Architecture — Unit 4: Intelligence Engine

**Date**: 2026-03-02
**Unit**: Unit 4: Intelligence Engine

---

## Component-to-Service Mapping

| Logical Component | Code Location | Deployed As | Service |
|------------------|--------------|-------------|---------|
| PatternDetectionHandler | `handlers/patternDetectionHandler.ts` | Module within cron function (60s) | Vercel |
| CoachingStrategyHandler | `handlers/coachingStrategyHandler.ts` | Module within brief generate function (30s) | Vercel |
| BriefGenerationHandler | `handlers/briefGenerationHandler.ts` | Module within brief generate function (30s) | Vercel |
| Brief generate route | `pages/api/brief/[teammateId]/generate.ts` | Serverless function **(30s)** | Vercel |
| Brief page (SSR shell) | `pages/teammates/[id]/brief.tsx` | SSR serverless function (10s, shell only) | Vercel |
| Teammate profile page (modified) | `pages/teammates/[id]/index.tsx` | SSR serverless function (10s) — MODIFIED | Vercel |
| Analysis cron route (modified) | `pages/api/jobs/process-analysis.ts` | Serverless function (60s) — MODIFIED | Vercel |
| PatternList component | `components/patterns/PatternList.tsx` | Static JS bundle | Vercel CDN |
| PatternCard component | `components/patterns/PatternCard.tsx` | Static JS bundle | Vercel CDN |
| BriefView component | `components/brief/BriefView.tsx` | Static JS bundle | Vercel CDN |
| BriefFallbackView component | `components/brief/BriefFallbackView.tsx` | Static JS bundle | Vercel CDN |
| CoachingApproachCard component | `components/brief/CoachingApproachCard.tsx` | Static JS bundle | Vercel CDN |
| QuestionList component | `components/brief/QuestionList.tsx` | Static JS bundle | Vercel CDN |
| CommitmentListMini component | `components/brief/CommitmentListMini.tsx` | Static JS bundle | Vercel CDN |
| PatternSignals component | `components/brief/PatternSignals.tsx` | Static JS bundle | Vercel CDN |
| patterns table | `prisma/schema.prisma` | PostgreSQL table | Supabase |
| claude-haiku (pattern detect) | External | Managed AI API | Anthropic |
| claude-haiku (framework select) | External | Managed AI API | Anthropic |
| claude-sonnet (brief generate) | External | Managed AI API | Anthropic |

---

## Request Flow Diagrams

### Flow 1: Pattern Detection (Cron-Chained)

```
Vercel Cron (every ~1 min)
  │
  │  GET /api/jobs/process-analysis
  │  [CRON_SECRET validation]
  ▼
Vercel Function (60s)
  │
  │  [Unit 3 analysis flow — unchanged]
  │  AnalysisJobQueue.processNext()
  │  MeetingAnalysisHandler.analyze(meetingId)
  │    → prisma.meeting.update(ANALYSIS_COMPLETE)
  │    → CommitmentTracker.saveSuggested()
  │    → prisma.analysisJob.update(COMPLETE)
  │
  │  ─── onComplete() EXTENDED (Unit 4) ───────────────────────┐
  │                                                             │
  │  try { detectPatterns(teammateId, managerId) }              │
  │    │                                                        │
  │    ├─ prisma.meeting.findMany(                              │
  │    │    where: { teammateId, ANALYSIS_COMPLETE },           │
  │    │    orderBy: createdAt ASC                              │
  │    │  )                                                     │
  │    │    └─ if meetings.length < 2 → return (no-op)         │
  │    │                                                        │
  │    ├─ Aggregate: tagFrequencies, summaries (last 5, 500ch)  │
  │    │                                                        │
  │    ├─ buildPatternPrompt(summaries, tagFreqs, name)         │
  │    │                                                        │
  │    ├─ callClaudeWithRetry(                                  │
  │    │    PATTERN_MODEL,     ─── Anthropic (Haiku) ──────────►│
  │    │    max_tokens: 1500   ◄──────── { patterns JSON } ─────│
  │    │  )                                                     │
  │    │                                                        │
  │    ├─ parsePatternResponse(text) → DetectedPattern[]        │
  │    │    └─ filter by VALID_SEVERITIES                       │
  │    │                                                        │
  │    └─ for each DetectedPattern:                             │
  │         ├─ check duplicate (severity + ≥2 tag overlap)     │
  │         │    ├─ match → prisma.pattern.update(evidence)    │
  │         │    └─ no match → count = prisma.pattern.count()  │
  │         │                    ├─ count >= 10 → evict oldest  │
  │         │                    │   (INFORMATIONAL → WATCH)   │
  │         │                    └─ prisma.pattern.create(...)  │
  │                                                             │
  │  } catch { console.error() }  ← swallowed (P-4.01)         │
  │  ─────────────────────────────────────────────────────────┘ │
  │                                                             │
  │  [Unit 3 notifications — unchanged]                         │
  │  NotificationService.notifyAnalysisComplete()               │
  │                                                             │
  ▼
  return 200 OK
```

---

### Flow 2: Teammate Profile Page — With Patterns (Modified)

```
Browser
  │  GET /teammates/[id]
  ▼
Vercel SSR Function (10s)
  │  withAuth → managerId
  │  [Unit 2+3 reads — unchanged]
  │  prisma.teammate.findFirst({ id, managerId })
  │  prisma.meeting.findMany(...)
  │
  │  [Unit 4 additions — parallel with existing reads]
  │  Promise.all([
  │    prisma.pattern.findMany({               ← NEW
  │      where: { teammate: { id, managerId }},
  │      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }]
  │    }),
  │    prisma.meeting.count({                  ← NEW
  │      where: { teammateId: id, managerId,
  │               status: 'ANALYSIS_COMPLETE' }
  │    }),
  │  ])
  │
  │  Render: AppLayout + TeammateHeader + MeetingList
  │        + PatternList (NEW — shows patterns or empty state)
  │        + CommitmentList + "Prepare for 1:1" button (NEW)
  ▼
Browser
  │  [Page displayed with patterns section]
  │  If patterns: PatternCard list (severity badges, description, evidence)
  │  If meetingCount < 2: "Add 2+ meetings to detect patterns"
  │  If meetingCount >= 2 but no patterns: "Analyzing for patterns..."
```

---

### Flow 3: Brief Generation (On-Demand)

```
Browser
  │  GET /teammates/[id]/brief  (SSR — shell only)
  ▼
Vercel SSR Function (10s)
  │  withAuth → managerId
  │  prisma.teammate.findFirst({ id, managerId })
  │    └─ not found → redirect to /teammates
  │  return { teammateName, teammateId, managerEmail }  ← shell props only
  ▼
Browser renders: AppLayout + Header + Spinner (< 200ms FCP)
  │
  │  useEffect() fires immediately on mount
  │  POST /api/brief/[teammateId]/generate
  ▼
Vercel Serverless Function (30s maxDuration)
  │  withAuth → managerId
  │  Verify teammate ownership (findFirst + managerId)
  │    └─ not found → 404
  │
  │  BriefGenerationHandler.generateBrief(managerId, teammateId)
  │    │
  │    ├─ Promise.all([                                [P-4.02]
  │    │    teammate.findFirst,
  │    │    meeting.findMany(ANALYSIS_COMPLETE, last 10),
  │    │    commitment.findMany(OPEN + CARRIED_FORWARD),
  │    │    pattern.findMany(ordered by severity desc)
  │    │  ])  ~200ms
  │    │
  │    ├─ meetings.length === 0 → throw EmptyHistoryError
  │    │    └─ API returns 422 { error: 'no_history' }
  │    │         └─ Browser shows "No meetings yet" state
  │    │
  │    ├─ CoachingStrategyHandler.selectFramework()  [Haiku ~3s]
  │    │    ├─ buildFrameworkSelectionPrompt(...)
  │    │    ├─ callClaudeWithRetry(FRAMEWORK_MODEL)  ─── Anthropic (Haiku) ──►
  │    │    │                                        ◄── { framework JSON } ───
  │    │    ├─ parseFrameworkResponse(text)
  │    │    └─ [on error] fallbackApproach()          ← generic framework
  │    │
  │    ├─ buildBriefPrompt(fullContext)
  │    │
  │    ├─ callClaudeWithRetry(BRIEF_MODEL, max_tokens: 3000)  [Sonnet ~7s]
  │    │         ─── Anthropic (Sonnet) ───────────────────────────────────►
  │    │         ◄── { brief JSON: contextSummary, openCommitments,        ─
  │    │               coachingFocus, riskSignals, followUpQuestions,      ─
  │    │               uncomfortableQuestion }                             ─
  │    │
  │    ├─ parseBriefResponse(text)
  │    │    └─ validate required fields present
  │    │
  │    ├─ assemble Brief (merge parsed + DB commitments + patterns + approach)
  │    │
  │    ├─ [success] → { brief: Brief, fallback: null }         [P-4.03]
  │    └─ [any error] → { brief: null, fallback: buildFallback(...) }
  │
  ▼ 200 OK { brief, fallback }
Browser
  │
  ├─ brief !== null → BriefView (all sections: context, commitments, patterns,
  │                               coaching approach, questions, uncomfortable Q)
  │                   + "Copy to Clipboard" button
  │                       └─ formatBriefAsText(brief, teammateName)  [P-4.07]
  │                          navigator.clipboard.writeText(text)
  │                          toast("Brief copied.") for 3s
  │
  └─ fallback !== null → BriefFallbackView
                          (open commitments + last meeting summary)
                          + "Try Again" button → re-triggers useEffect
```

---

## Environment Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  LOCAL DEVELOPMENT (No changes from Unit 3)                  │
│                                                              │
│  npm run dev (Next.js dev server :3000)                      │
│                                                              │
│  .env.local (unchanged — 13 vars):                           │
│    DATABASE_URL=postgresql://...          [Unit 1]           │
│    DIRECT_URL=postgresql://...            [Unit 1]           │
│    SECRET_KEY=local-dev-secret...         [Unit 1]           │
│    RESEND_API_KEY=re_placeholder          [Unit 1]           │
│    CRON_SECRET=local-cron-secret          [Unit 1]           │
│    NEXT_PUBLIC_APP_URL=http://localhost:3000 [Unit 1]        │
│    ANTHROPIC_API_KEY=sk-ant-...           [Unit 2]           │
│    OPENAI_API_KEY=sk-...                  [Unit 3]           │
│    NEXT_PUBLIC_VAPID_PUBLIC_KEY=BExa...   [Unit 3]           │
│    VAPID_PRIVATE_KEY=Exa...               [Unit 3]           │
│    VAPID_SUBJECT=mailto:admin@example.com [Unit 3]           │
│    SUPABASE_URL=https://xyz.supabase.co   [Unit 3]           │
│    SUPABASE_SERVICE_ROLE_KEY=eyJ...       [Unit 3]           │
│                                                              │
│  Unit 4 external calls:                                      │
│    ├── Supabase PostgreSQL (patterns table — existing dev)   │
│    └── Anthropic Claude API (Haiku + Sonnet — real calls)    │
│                                                              │
│  Cron simulation (unchanged):                                │
│    curl http://localhost:3000/api/jobs/process-analysis      │
│         -H "Authorization: Bearer local-cron-secret"        │
│  Brief endpoint test:                                        │
│    curl -X POST http://localhost:3000/api/brief/{id}/generate│
│         -H "Cookie: session=..." ← requires auth            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  PRODUCTION (Vercel — No new config required)                │
│                                                              │
│  Build: prisma generate && next build   (unchanged)          │
│  Deploy: git push → Vercel CI/CD        (unchanged)          │
│                                                              │
│  Environment Variables (unchanged — 13 total):               │
│    DATABASE_URL             (Unit 1)                         │
│    DIRECT_URL               (Unit 1)                         │
│    SECRET_KEY               (Unit 1)                         │
│    RESEND_API_KEY            (Unit 1)                        │
│    CRON_SECRET               (Unit 1)                        │
│    NEXT_PUBLIC_APP_URL       (Unit 1)                        │
│    ANTHROPIC_API_KEY         (Unit 2)                        │
│    OPENAI_API_KEY            (Unit 3)                        │
│    NEXT_PUBLIC_VAPID_PUBLIC_KEY (Unit 3)                     │
│    VAPID_PRIVATE_KEY         (Unit 3)                        │
│    VAPID_SUBJECT             (Unit 3)                        │
│    SUPABASE_URL              (Unit 3)                        │
│    SUPABASE_SERVICE_ROLE_KEY (Unit 3)                        │
│                                                              │
│  Serverless functions (updated):                             │
│    /api/auth/*                   → 10s  (Unit 1)            │
│    /api/teammates/*              → 10s  (Unit 2)            │
│    /api/interviews/*             → 30s  (Unit 2)            │
│    /api/meetings/*/*             → 10s  (Unit 3)            │
│    /api/transcription/start      → 10s  (Unit 3)            │
│    /api/transcription/transcribe → 60s  (Unit 3)            │
│    /api/transcription/[fileId]   → 10s  (Unit 3)            │
│    /api/commitments/*            → 10s  (Unit 3)            │
│    /api/notifications/subscribe  → 10s  (Unit 3)            │
│    /api/jobs/process-analysis    → 60s  (Unit 3, cron)      │
│    /api/brief/[id]/generate      → 30s  [NEW Unit 4]        │
│                                                              │
│  Vercel Cron (unchanged):                                    │
│    */1 * * * * → /api/jobs/process-analysis                  │
│                                                              │
│  External calls:                                             │
│    ├── Supabase PostgreSQL (patterns + meetings + others)    │
│    ├── Anthropic Claude API (Haiku: patterns + framework)    │
│    ├── Anthropic Claude API (Sonnet: brief + meeting analysis│
│    │   from Unit 3)                                          │
│    ├── OpenAI Whisper API (Unit 3, unchanged)                │
│    ├── Supabase Storage (Unit 3, unchanged)                  │
│    └── Browser Push / Resend (Unit 3, unchanged)             │
└──────────────────────────────────────────────────────────────┘
```

---

## Security Boundary Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (Public)                                            │
│  - React UI (PatternList, BriefView, BriefFallbackView)      │
│  - useEffect triggers POST /api/brief/[id]/generate          │
│  - navigator.clipboard.writeText() (client-side only)        │
│  - JWT session cookie (httpOnly — not readable by JS)        │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼───────────────────────────────────────┐
│  Vercel Serverless Functions (Trusted)                       │
│  - withAuth validates JWT → managerId (all new routes)       │
│  - managerId NEVER from query params or body                 │
│  - teammate ownership verified before any data access        │
│  - ANTHROPIC_API_KEY: env-only, never in client bundle       │
│  - Pattern data filtered by managerId (via teammate join)    │
│  - Brief data scoped to authenticated manager only          │
└──────┬───────────────────────────────────────────────────────┘
       │ Prisma (TLS)                  │ @anthropic-ai/sdk (HTTPS)
┌──────▼──────┐                ┌───────▼──────────────────────┐
│Supabase     │                │  Anthropic Claude API        │
│PostgreSQL   │                │  - Haiku (pattern detect)    │
│- patterns   │                │  - Haiku (framework select)  │
│- meetings   │                │  - Sonnet (brief generate)   │
│- teammates  │                │  - Sonnet (meeting analysis) │
│- commitments│                │    [Unit 3, unchanged]       │
└─────────────┘                └──────────────────────────────┘
```

---

## Technical Debt (Unit 4 Additions)

| ID | Item | Infrastructure Impact |
|----|------|-----------------------|
| TD-14 | No client-side timeout on brief fetch | Browser waits up to 30s if Sonnet is slow; no AbortController signal on `fetch()` |
| TD-15 | Approximate pattern deduplication | Near-duplicate patterns not caught if tag overlap < 2 — only semantic duplicates |
| TD-16 | Plain-text brief clipboard format | No Markdown or HTML — structured but not formatted for rich-text paste targets |
