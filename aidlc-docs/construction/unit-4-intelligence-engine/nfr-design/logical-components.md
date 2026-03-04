# Logical Components — Unit 4: Intelligence Engine

**Date**: 2026-03-02
**Unit**: Unit 4: Intelligence Engine

---

## New Logical Components

---

### LC-4.01 — PatternDetectionHandler

**File**: `handlers/patternDetectionHandler.ts`
**Deployed as**: Module within cron serverless function (chained from Unit 3)
**Patterns applied**: P-4.01 (failure isolation), P-4.04 (Haiku model), P-4.05 (bounded collection)

**Interface**:
```typescript
// Exported functions
export async function detectPatterns(
  teammateId: string,
  managerId: string,
  client?: Anthropic  // injectable for tests
): Promise<void>

export function buildPatternPrompt(
  meetingSummaries: string[],
  tagFrequencies: Record<string, number>,
  teammateName: string
): string

export function parsePatternResponse(text: string): DetectedPattern[]

export class PatternParseError extends Error {}

// Constants
export const PATTERN_MODEL = 'claude-haiku-4-5-20251001'
export const VALID_SEVERITIES = ['INFORMATIONAL', 'WATCH', 'ACTION_REQUIRED'] as const
export const MAX_PATTERNS_PER_TEAMMATE = 10
```

**Dependencies**: `@anthropic-ai/sdk`, `@prisma/client` (via `lib/prisma`)
**Called by**: `handlers/meetingAnalysisHandler.ts` → `onComplete()`

---

### LC-4.02 — CoachingStrategyHandler

**File**: `handlers/coachingStrategyHandler.ts`
**Deployed as**: Module within `/api/brief/[teammateId]/generate` serverless function
**Patterns applied**: P-4.04 (Haiku model)

**Interface**:
```typescript
export async function selectFramework(
  teammate: { profile: unknown; name: string },
  recentPatterns: Pattern[],
  openCommitments: Commitment[],
  client?: Anthropic
): Promise<CoachingApproach>

export function buildFrameworkSelectionPrompt(
  teammateName: string,
  profile: unknown,
  patterns: Pattern[],
  commitments: Commitment[]
): string

export function parseFrameworkResponse(text: string): CoachingApproach | null

export function fallbackApproach(): CoachingApproach

// Constants
export const FRAMEWORK_MODEL = 'claude-haiku-4-5-20251001'
export const VALID_FRAMEWORKS = ['GROW', 'SBI', 'STRENGTHS', 'OSCAR', 'SOCRATIC', 'MOTIVATIONAL'] as const
```

**Dependencies**: `@anthropic-ai/sdk`, `@prisma/client` types (no DB writes)
**Called by**: `handlers/briefGenerationHandler.ts` → `generateBrief()`

---

### LC-4.03 — BriefGenerationHandler

**File**: `handlers/briefGenerationHandler.ts`
**Deployed as**: Module within `/api/brief/[teammateId]/generate` serverless function
**Patterns applied**: P-4.02 (parallel DB pre-fetch), P-4.03 (graceful degradation), P-4.04 (Sonnet model), P-4.07 (text serializer)

**Interface**:
```typescript
export async function generateBrief(
  managerId: string,
  teammateId: string,
  client?: Anthropic
): Promise<{ brief: Brief | null; fallback: BriefFallback | null }>

export function buildBriefPrompt(context: BriefContext): string

export function parseBriefResponse(text: string): Partial<Brief>

export function buildFallback(
  commitments: Commitment[],
  lastMeeting: Meeting | null
): BriefFallback

export function formatBriefAsText(brief: Brief, teammateName: string): string

export class EmptyHistoryError extends Error {}
export class BriefParseError extends Error {}

// Constants
export const BRIEF_MODEL = 'claude-sonnet-4-6'
export const MAX_MEETINGS_FOR_BRIEF = 10
```

**Dependencies**: `@anthropic-ai/sdk`, `@prisma/client` (4 parallel reads), `handlers/coachingStrategyHandler`
**Called by**: `pages/api/brief/[teammateId]/generate.ts`

---

## Inherited Logical Components (from Units 1–3, used by Unit 4)

| Component | File | Unit 4 Usage |
|-----------|------|-------------|
| LC-1.01 withAuth HOC | `lib/withAuth.ts` | All new API routes |
| LC-1.02 Prisma client | `lib/prisma.ts` | All DB reads/writes |
| LC-1.04 sendError | `lib/apiError.ts` | Error responses in new routes |
| LC-2.01 callClaudeWithRetry | `handlers/interviewAIHandler.ts` | Pattern adopted (inlined per handler) |
| LC-3.08 MeetingAnalysisHandler | `handlers/meetingAnalysisHandler.ts` | Modified: `onComplete()` chains `detectPatterns()` |

---

## API Route Components

### LC-4.04 — `/api/brief/[teammateId]/generate`

**File**: `pages/api/brief/[teammateId]/generate.ts`
**Method**: POST
**Auth**: `withAuth`
**Timeout**: `maxDuration: 30`

**Request**: No body required (teammateId from route param)
**Response**:
```typescript
// 200 — success
{ brief: Brief, fallback: null }

// 200 — Claude failure (graceful degradation)
{ brief: null, fallback: BriefFallback }

// 404 — teammate not found / not owned by manager
{ error: 'Teammate not found' }

// 422 — no meeting history
{ error: 'no_history' }

// 500 — unexpected error
{ error: 'Something went wrong. Please try again.' }
```

**Logic**:
```
withAuth → managerId
│
├─ Verify teammate ownership (teammate.managerId === managerId)
│    └─ if not found → 404
│
└─ BriefGenerationHandler.generateBrief(managerId, teammateId)
     ├─ EmptyHistoryError → 422
     └─ Result → 200 { brief, fallback }
```

---

### LC-4.05 — `pages/api/teammates/[id]/index.tsx` SSR — MODIFIED

**Change**: Add patterns + meetingCount to `getServerSideProps`.

**Additional SSR reads**:
```typescript
const [patterns, meetingCount] = await Promise.all([
  prisma.pattern.findMany({
    where: { teammate: { id, managerId } },
    orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
  }),
  prisma.meeting.count({
    where: { teammateId: id, managerId, status: 'ANALYSIS_COMPLETE' },
  }),
])
```

**New props added**: `patterns: Pattern[]`, `meetingCount: number`

---

## Component Dependency Map

### Unit 4 API Route Dependencies

```
POST /api/brief/[teammateId]/generate
  └── BriefGenerationHandler.generateBrief()
        ├── prisma.teammate.findFirst()          [ownership check]
        ├── Promise.all([4 DB reads])            [P-4.02]
        ├── CoachingStrategyHandler.selectFramework()
        │     └── callClaudeWithRetry(FRAMEWORK_MODEL)  [Haiku]
        ├── buildBriefPrompt()
        ├── callClaudeWithRetry(BRIEF_MODEL)     [Sonnet]
        ├── parseBriefResponse()
        └── [on failure] buildFallback()         [P-4.03]

GET /api/teammates/[id] (SSR page)
  └── prisma.pattern.findMany()
  └── prisma.meeting.count()
  └── PatternList → PatternCard (client render)
```

### Cron Chain (Unit 3 → Unit 4)

```
GET /api/jobs/process-analysis                  [Unit 3]
  └── processNext(analyzeFn)
        └── analyze(meetingId)                  [Unit 3]
              └── onComplete()                  [MODIFIED — Unit 4 chains here]
                    ├── saveSuggested()         [Unit 3]
                    └── detectPatterns()        [P-4.01 — Unit 4]
                          ├── if < 2 meetings → return
                          ├── buildPatternPrompt()
                          ├── callClaudeWithRetry(PATTERN_MODEL)  [Haiku]
                          ├── parsePatternResponse()
                          └── upsertPattern() × N   [P-4.05]
```

---

## Data Flow Diagrams

### Flow 1: Pattern Detection (Cron-Chained)

```
Cron tick
  │
  ▼
analyze(meetingId) completes
  │  meeting.status = ANALYSIS_COMPLETE
  ▼
detectPatterns(teammateId, managerId)
  │
  ├─ prisma.meeting.findMany(ANALYSIS_COMPLETE, ASC)
  │    └─ if < 2 → return early
  │
  ├─ Aggregate: tagFrequencies, summaries (last 5, 500 chars each)
  │
  ├─ buildPatternPrompt(summaries, tagFreqs, teammateName)
  │
  ├─ callClaudeWithRetry(PATTERN_MODEL, prompt, max_tokens: 1500)
  │    └─ parsePatternResponse(text) → DetectedPattern[]
  │
  └─ For each DetectedPattern:
       ├─ Check for duplicate (same severity + ≥2 tag overlap)
       │    ├─ match found → update description + evidence
       │    └─ no match → check count ≥ 10?
       │                    └─ yes → evict lowest severity/oldest [P-4.05]
       └─ prisma.pattern.create(...)
```

### Flow 2: Brief Generation (On-Demand)

```
Manager → /teammates/[id]/brief
  │  SSR: shell only (AppLayout + spinner)   [P-4.06]
  │
  ▼
useEffect → POST /api/brief/[id]/generate
  │
  ▼
BriefGenerationHandler.generateBrief()
  │
  ├─ Promise.all([teammate, meetings×10, commitments(OPEN/CF), patterns])  [P-4.02]
  │
  ├─ meetings.length === 0 → throw EmptyHistoryError → API 422
  │
  ├─ CoachingStrategyHandler.selectFramework()         [Haiku ~3s]
  │    ├─ buildFrameworkSelectionPrompt()
  │    ├─ callClaudeWithRetry(FRAMEWORK_MODEL)
  │    ├─ parseFrameworkResponse() → CoachingApproach
  │    └─ [on error] → fallbackApproach()
  │
  ├─ buildBriefPrompt(fullContext)
  ├─ callClaudeWithRetry(BRIEF_MODEL, max_tokens: 3000)   [Sonnet ~7s]
  ├─ parseBriefResponse(text)                           [validate required fields]
  ├─ assemble Brief (merge DB commitments + patterns + coachingApproach)
  │
  ├─ [success] → { brief: Brief, fallback: null }       [P-4.03]
  └─ [any error] → { brief: null, fallback: BriefFallback }  [P-4.03]
  │
  ▼
Browser
  ├─ brief → BriefView (all sections)
  └─ fallback → BriefFallbackView + "Try Again" button
```
