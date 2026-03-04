# Logical Components — Unit 2: Teammate Profiles

**Date**: 2026-03-01
**Unit**: Unit 2: Teammate Profiles

---

## Component Overview

| ID | Component | File | Responsibility |
|----|-----------|------|---------------|
| LC-2.01 | InterviewAIHandler | `handlers/interviewAIHandler.ts` | All Claude API calls for interview + synthesis |
| LC-2.02 | TeammateService | `lib/teammates.ts` | CRUD business logic + completeness calculation |
| LC-2.03 | ClaudeRetryWrapper | Inside `handlers/interviewAIHandler.ts` | Retry logic for transient Claude failures |
| LC-2.04 | ProfileSynthesizer | Inside `handlers/interviewAIHandler.ts` | Prompt building + JSON parsing for synthesis |
| LC-2.05 | withAuth (Unit 1) | `lib/withAuth.ts` | Session validation (inherited, no changes) |
| LC-2.06 | Prisma Singleton (Unit 1) | `lib/prisma.ts` | DB client (inherited, no changes) |
| LC-2.07 | ApiError Helpers (Unit 1) | `lib/apiError.ts` | Consistent error responses (inherited, no changes) |
| LC-2.08 | InterviewChatPage | `pages/teammates/[id]/interview.tsx` | Interview UI page (client-side state machine) |

---

## LC-2.01: InterviewAIHandler

**File**: `handlers/interviewAIHandler.ts`
**Patterns**: P-2.01 (Tiered Model), P-2.03 (Retry), P-2.07 (Input Truncation), P-2.08 (Composable Handler)

**Interface**:
```typescript
import Anthropic from '@anthropic-ai/sdk'

export interface NextQuestionResult {
  question: string
  questionIndex: number
  area: ProfileArea
  isComplete: boolean
}

export interface GenerateProfileResult {
  profile: ProfileFields
  warning?: string   // set if JSON parse fell back to raw storage
}

// Exported for testing — accepts optional client for DI
export async function nextQuestion(
  teammateName: string,
  role: string,
  conversationHistory: ConversationTurn[],
  latestAnswer: string,
  client?: Anthropic
): Promise<NextQuestionResult>

export async function generateProfile(
  teammateName: string,
  role: string,
  conversationHistory: ConversationTurn[],
  client?: Anthropic
): Promise<GenerateProfileResult>
```

**Internal helpers** (not exported):
```typescript
function buildNextQuestionPrompt(
  teammateName: string,
  role: string,
  history: ConversationTurn[],
  latestAnswer: string,
  nextArea: ProfileArea
): string

function buildSynthesisPrompt(
  teammateName: string,
  role: string,
  history: ConversationTurn[]
): string

function sanitizeAnswer(answer: string): string   // truncate at 2000 chars

function parseProfileJSON(text: string): ProfileFields | null  // JSON.parse + regex fallback
```

**Dependencies**:
- `@anthropic-ai/sdk` (Claude API)
- `LC-2.03` ClaudeRetryWrapper (inline)
- `LC-2.04` ProfileSynthesizer (inline)

**Data flows**:
```
nextQuestion():
  inputs: teammateName, role, conversationHistory, latestAnswer
    --> sanitizeAnswer(latestAnswer)
    --> buildNextQuestionPrompt(...)
    --> callClaudeWithRetry(haiku, prompt)
    --> { question, questionIndex, area, isComplete }

generateProfile():
  inputs: teammateName, role, conversationHistory (7 turns)
    --> buildSynthesisPrompt(...)
    --> callClaudeWithRetry(sonnet, prompt)
    --> parseProfileJSON(responseText)
      --> success: { profile: ProfileFields }
      --> fail:    { profile: { _rawAnswers: [...] }, warning: "..." }
```

---

## LC-2.02: TeammateService

**File**: `lib/teammates.ts`
**Patterns**: P-2.06 (Key Isolation via session, not directly), P-2.08 (Composable)

**Interface**:
```typescript
export interface TeammateListItem {
  id: string
  name: string
  role: string
  profileCompleteness: number   // 0–8
  createdAt: string
}

export interface TeammateDetail {
  id: string
  managerId: string
  name: string
  role: string
  profile: ProfileFields | null
  profileCompleteness: number
  createdAt: string
  updatedAt: string
}

export async function createTeammate(
  managerId: string,
  name: string,
  role: string
): Promise<{ id: string; name: string; role: string; createdAt: string }>

export async function listTeammates(
  managerId: string
): Promise<TeammateListItem[]>

export async function getTeammate(
  managerId: string,
  teammateId: string
): Promise<TeammateDetail | null>   // null if not found or wrong manager

export async function updateTeammate(
  managerId: string,
  teammateId: string,
  updates: { name?: string; role?: string; profile?: Partial<ProfileFields> }
): Promise<TeammateDetail | null>

export async function deleteTeammate(
  managerId: string,
  teammateId: string
): Promise<boolean>   // false if not found or wrong manager

export function countPopulatedFields(
  role: string,
  profile: ProfileFields | null
): number   // 0–8; pure function, no DB access
```

**Key behaviour — `countPopulatedFields`**:
```typescript
export function countPopulatedFields(role: string, profile: ProfileFields | null): number {
  let count = role && role.trim().length > 0 ? 1 : 0   // role always = 1 after creation
  if (!profile) return count
  const keys: (keyof ProfileFields)[] = [
    'strengths', 'growthAreas', 'aspirations', 'kpis',
    'behavioralTendencies', 'feedbackStyle', 'motivationDrivers'
  ]
  for (const key of keys) {
    const val = profile[key]
    if (val && val.trim().length > 0) count++
  }
  return count   // max 8; _rawAnswers key is ignored
}
```

**Key behaviour — `updateTeammate` (profile merge)**:
```typescript
// Fetches existing profile, merges new values, writes back
const existing = await prisma.teammate.findFirst({ where: { id, managerId } })
if (!existing) return null
const mergedProfile = { ...(existing.profile as ProfileFields ?? {}), ...updates.profile }
await prisma.teammate.update({ where: { id }, data: { ...topLevelUpdates, profile: mergedProfile } })
```

**Dependencies**:
- `LC-2.06` Prisma Singleton

---

## LC-2.03: ClaudeRetryWrapper

**Location**: Inline in `handlers/interviewAIHandler.ts` (not a separate file — single-use utility)
**Pattern**: P-2.03 (Single Retry)

**Interface**:
```typescript
async function callClaudeWithRetry<T>(
  fn: () => Promise<T>,
  retries?: number,      // default: 1
  delayMs?: number       // default: 1000
): Promise<T>

function isTransientClaudeError(err: unknown): boolean
```

**Error classification**:
```
Transient (retry):        Non-transient (fail fast):
  5xx errors                4xx errors (except 429)
  529 overloaded            401 invalid key
  Network fetch errors      400 bad request
```

> **Note**: Rate limiting (429) is classified as transient and will retry once. This is a best-effort decision — Claude rate limits typically resolve within seconds.

---

## LC-2.04: ProfileSynthesizer

**Location**: Inline in `handlers/interviewAIHandler.ts` (sub-functions of `generateProfile`)
**Pattern**: P-2.05 (Synthesis Fallback with Raw Storage)

**Interface**:
```typescript
function buildSynthesisPrompt(
  teammateName: string,
  role: string,
  history: ConversationTurn[]
): string

function parseProfileJSON(claudeText: string): ProfileFields | null
// Returns null if both JSON.parse and regex extraction fail
```

**parseProfileJSON logic**:
```
Step 1: JSON.parse(claudeText)
  → success: return parsed object (validate has expected keys)
  → SyntaxError: go to Step 2

Step 2: regex match /\{[\s\S]*\}/ (first JSON block in text)
  → match found: JSON.parse(match)
    → success: return parsed object
    → SyntaxError: go to Step 3
  → no match: go to Step 3

Step 3: return null (caller stores { _rawAnswers: history })
```

---

## LC-2.05: withAuth (Inherited from Unit 1)

**File**: `lib/withAuth.ts`
**No changes required.**

Used in all 7 Unit 2 API routes and both new pages (`getServerSideProps`).

```typescript
// API route usage (same as Unit 1)
export default withAuth(async (req, res, managerId) => {
  // managerId is always present here
})

// Page usage (same as Unit 1)
export const getServerSideProps = withAuth(async (context, managerId) => {
  return { props: { managerId, ... } }
})
```

---

## LC-2.06: Prisma Singleton (Inherited from Unit 1)

**File**: `lib/prisma.ts`
**No changes required.**

All `TeammateService` functions import `prisma` from this file.

---

## LC-2.07: ApiError Helpers (Inherited from Unit 1)

**File**: `lib/apiError.ts`
**No changes required.**

```typescript
sendError(res, 400, 'Name is required.')
sendError(res, 404, 'Not found.')
sendError(res, 500, INTERNAL_ERROR)
```

Used in all Unit 2 API routes for consistent error shapes.

---

## LC-2.08: InterviewChatPage (Client-Side State Machine)

**File**: `pages/teammates/[id]/interview.tsx`
**Pattern**: P-2.02 (Client-Side Conversation State), P-2.04 (Graceful Fallback)

This page component acts as a client-side state machine for the interview flow:

```
States:
  LOADING_FIRST_QUESTION  → API call in flight for Q1
  AWAITING_ANSWER         → Question displayed, textarea active
  SUBMITTING_ANSWER       → API call in flight for next question
  SYNTHESIZING            → POST /complete in flight
  COMPLETE                → Redirect to /teammates/[id]
  FALLBACK                → Claude error; redirect to /teammates/[id]?editMode=1

Transitions:
  LOADING_FIRST_QUESTION
    → success: AWAITING_ANSWER (currentQuestionIndex = 1)
    → Claude error: FALLBACK

  AWAITING_ANSWER
    → "Submit" clicked: SUBMITTING_ANSWER

  SUBMITTING_ANSWER
    → success + isComplete=false: AWAITING_ANSWER (next question)
    → success + isComplete=true: SYNTHESIZING
    → Claude error: FALLBACK

  SYNTHESIZING
    → success: COMPLETE (redirect)
    → Claude error: FALLBACK (with warning toast)

  FALLBACK
    → redirect to /teammates/[id]?editMode=1
```

**State held in React `useState`** (not persisted — TD-07):
```typescript
const [state, setState] = useState<InterviewPageState>({
  turns: [],
  currentQuestionIndex: 0,
  currentQuestion: '',
  currentArea: ProfileArea.STRENGTHS,
  currentAnswer: '',
  isLoading: true,
  isComplete: false,
  isSynthesizing: false,
  isFallback: false,
  error: null,
})
```

---

## Component Dependency Map

```
pages/api/teammates/index.ts
  └── LC-2.02 TeammateService (list, create)
  └── LC-2.05 withAuth
  └── LC-2.07 ApiError

pages/api/teammates/[id].ts
  └── LC-2.02 TeammateService (get, update, delete)
  └── LC-2.05 withAuth
  └── LC-2.07 ApiError

pages/api/interviews/[teammateId]/next.ts
  └── LC-2.01 InterviewAIHandler (nextQuestion)
  └── LC-2.02 TeammateService (ownership check via getTeammate)
  └── LC-2.05 withAuth
  └── LC-2.07 ApiError

pages/api/interviews/[teammateId]/complete.ts
  └── LC-2.01 InterviewAIHandler (generateProfile)
  └── LC-2.02 TeammateService (updateTeammate — write synthesized profile)
  └── LC-2.05 withAuth
  └── LC-2.07 ApiError

handlers/interviewAIHandler.ts (LC-2.01)
  └── LC-2.03 ClaudeRetryWrapper (inline)
  └── LC-2.04 ProfileSynthesizer (inline)
  └── @anthropic-ai/sdk

lib/teammates.ts (LC-2.02)
  └── LC-2.06 Prisma Singleton
  └── countPopulatedFields (pure, inline)

pages/teammates/[id]/interview.tsx (LC-2.08)
  └── components/interview/InterviewChat
  └── React state machine (client)

pages/index.tsx (Dashboard — enhanced)
  └── LC-2.05 withAuth (getServerSideProps)
  └── components/teammates/TeammateList
  └── components/teammates/AddTeammateModal

pages/teammates/[id]/index.tsx (Profile page — new)
  └── LC-2.05 withAuth (getServerSideProps)
  └── components/teammates/ProfileView
```

---

## Data Flow Diagrams

### Interview Next Question

```
Client                          Server                      Claude API
  |                               |                              |
  |-- POST /interviews/[id]/next  |                              |
  |   { conversationHistory,      |                              |
  |     latestAnswer }            |                              |
  |                               |                              |
  |                    [withAuth: extract managerId]             |
  |                    [validate body]                           |
  |                    [getTeammate: verify ownership]           |
  |                               |                              |
  |                    [sanitizeAnswer(latestAnswer)]            |
  |                    [buildNextQuestionPrompt()]               |
  |                               |                              |
  |                               |-- messages.create() ------->|
  |                               |   model: haiku              |
  |                               |   max_tokens: 300           |
  |                               |                              |
  |                               |<-- { content[0].text } -----|
  |                               |                              |
  |<-- { question, area,          |                              |
  |      questionIndex,           |                              |
  |      isComplete }             |                              |
```

### Profile Synthesis

```
Client                          Server                      Claude API      DB
  |                               |                              |            |
  |-- POST /interviews/[id]/      |                              |            |
  |   complete                    |                              |            |
  |   { conversationHistory[7] }  |                              |            |
  |                               |                              |            |
  |                    [withAuth + ownership check]              |            |
  |                    [validate: history.length === 7]          |            |
  |                    [buildSynthesisPrompt()]                  |            |
  |                               |                              |            |
  |                               |-- messages.create() ------->|            |
  |                               |   model: sonnet             |            |
  |                               |   max_tokens: 1024          |            |
  |                               |                             |            |
  |                               |<-- { content[0].text } -----|            |
  |                               |                              |            |
  |                    [parseProfileJSON(text)]                  |            |
  |                               |                             |            |
  |                               |-- updateTeammate() -------->|            |
  |                               |   profile: ProfileFields     |            |
  |                               |                              |            |
  |<-- { profile: ProfileFields } |                              |            |
```
