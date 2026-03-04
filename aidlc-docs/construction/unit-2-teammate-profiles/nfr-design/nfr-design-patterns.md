# NFR Design Patterns — Unit 2: Teammate Profiles

**Date**: 2026-03-01
**Unit**: Unit 2: Teammate Profiles

---

## Pattern Overview

| # | Pattern | NFR Addressed |
|---|---------|--------------|
| P-2.01 | Tiered-Model AI | Performance — latency vs. quality trade-off |
| P-2.02 | Client-Side Conversation State | Scalability — stateless server |
| P-2.03 | Single-Retry with Fixed Delay | Reliability — transient Claude failure recovery |
| P-2.04 | Graceful AI Fallback | Reliability — Claude unavailability |
| P-2.05 | Synthesis Fallback with Raw Storage | Reliability — malformed JSON recovery |
| P-2.06 | Server-Side API Key Isolation | Security — ANTHROPIC_API_KEY protection |
| P-2.07 | Input Truncation Before Prompt | Security — prompt injection surface reduction |
| P-2.08 | Composable Handler Architecture | Maintainability — thin routes, testable handlers |

---

## P-2.01: Tiered-Model AI Pattern

**Problem**: Interview question generation requires low latency (conversational feel); profile synthesis requires high reasoning quality. Using a single model forces a compromise on both dimensions.

**Design**:
```
Interview Q&A loop        Profile synthesis
(latency-sensitive)       (quality-sensitive)
        |                         |
        v                         v
claude-haiku-4-5          claude-sonnet-4-6
(~1-2s, 300 max_tokens)   (~8-12s, 1024 max_tokens)
        |                         |
        v                         v
  { question, area }       { ProfileFields JSON }
```

**Implementation**:
```typescript
// handlers/interviewAIHandler.ts
const INTERVIEW_MODEL = 'claude-haiku-4-5-20251001'  // fast, conversational
const SYNTHESIS_MODEL = 'claude-sonnet-4-6'           // quality, structured output

export async function nextQuestion(...): Promise<NextQuestionResponse> {
  return callClaudeWithRetry(() =>
    anthropic.messages.create({ model: INTERVIEW_MODEL, max_tokens: 300, ... })
  )
}

export async function generateProfile(...): Promise<ProfileFields> {
  return callClaudeWithRetry(() =>
    anthropic.messages.create({ model: SYNTHESIS_MODEL, max_tokens: 1024, ... })
  )
}
```

**Trade-offs**:
- Two model IDs to maintain (minor operational overhead)
- Cost-optimised: 7 Haiku calls (~$0.001) + 1 Sonnet call (~$0.01) per interview vs. 8 Sonnet calls (~$0.08)
- Sonnet can be swapped for a faster model in future without changing the design

---

## P-2.02: Client-Side Conversation State Pattern

**Problem**: The interview spans 7 request-response turns. Storing conversation history server-side requires either a database table or a session store — both add complexity and state management overhead to a stateless serverless deployment.

**Design**:
```
Client (React State)                Server (Stateless)
--------------------                ------------------
InterviewSessionState               POST /api/interviews/[id]/next
  turns: ConversationTurn[]    -->  Receives full history each call
  currentQuestion: string      <--  Returns next question
  currentAnswer: string
  isComplete: boolean

Each request is self-contained:
  { conversationHistory: [...all prior turns...], latestAnswer: "..." }
```

**Implementation**:
```typescript
// Client sends the full accumulated history with every request
const response = await fetch(`/api/interviews/${teammateId}/next`, {
  method: 'POST',
  body: JSON.stringify({
    conversationHistory: turns,   // all answered turns so far
    latestAnswer: currentAnswer,  // the answer just submitted
  }),
})

// Server derives question index from history length — no server state needed
const nextIndex = req.body.conversationHistory.length + 1
```

**Trade-offs**:
- Payload grows with each turn (max ~7 turns × ~300 chars/turn = ~2KB — negligible)
- Interview state lost if manager closes the browser tab (acceptable for PoC — TD-07)
- Server is fully stateless: no DB reads needed for interview progression

---

## P-2.03: Single-Retry with Fixed Delay Pattern

**Problem**: Claude API occasionally returns transient errors (529 overloaded, network timeouts). Failing immediately on every transient error degrades the interview experience unnecessarily. Full exponential backoff adds too much wait time.

**Design**:
```
callClaudeWithRetry(fn)
    |
    v
  fn() -- success --> return result
    |
   fail
    |
  isTransientError?
    |-- No (4xx) --> throw immediately
    |
    Yes (5xx / 529 / network)
    |
  wait 1000ms
    |
    v
  fn() -- success --> return result
    |
   fail --> throw (bubble to route handler --> 503)
```

**Implementation**:
```typescript
async function callClaudeWithRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 1000
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (retries > 0 && isTransientClaudeError(err)) {
      await delay(delayMs)
      return callClaudeWithRetry(fn, retries - 1, delayMs)
    }
    throw err
  }
}

function isTransientClaudeError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return err.status >= 500 || err.status === 529
  }
  return err instanceof Error && err.message.toLowerCase().includes('fetch')
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
```

**Trade-offs**:
- Adds up to 1s extra latency on a transient failure (acceptable)
- Does not retry 401/403 (correct — API key errors should not be retried silently)
- Single retry is sufficient for most transient overload scenarios

---

## P-2.04: Graceful AI Fallback Pattern

**Problem**: Claude API may be unavailable at the point of the interview (outage, key misconfiguration). The manager has already created the teammate record and should not be left in a dead-end state.

**Design**:
```
Interview request
    |
    v
callClaudeWithRetry() -- throws after retry exhausted
    |
    v
Route handler catches error
    |
    v
return HTTP 503 {
  fallback: true,
  message: "AI interview unavailable. You can fill in the profile manually."
}
    |
    v
Client intercepts { fallback: true }
    |
    v
Navigate to /teammates/[id]?editMode=1
    |
    v
Profile page opens in edit mode (all fields empty, manager fills manually)
```

**Key property**: The teammate record was created before the interview started. Claude failure never loses the teammate record — only the interview answers (held in client state).

**Trade-offs**:
- Partial interview answers are lost on fallback (no recovery path — TD-07)
- Manager must fill profile manually, which is a worse UX than the interview
- Acceptable for PoC; could be improved with IndexedDB persistence of in-progress answers

---

## P-2.05: Synthesis Fallback with Raw Storage Pattern

**Problem**: Claude Sonnet may return malformed JSON for the profile synthesis (despite prompt engineering). Silently discarding the synthesis result loses the manager's 7 interview answers.

**Design**:
```
POST /api/interviews/[id]/complete
    |
    v
Claude Sonnet returns response text
    |
    v
JSON.parse(responseText) -- success --> ProfileFields
    |
   fail
    |
    v
regex extraction: /\{[\s\S]*\}/
    |-- match found --> JSON.parse(match) --> ProfileFields
    |
   no match
    |
    v
Store { _rawAnswers: conversationHistory } in Teammate.profile
Return { profile: { _rawAnswers: [...] }, warning: "Profile auto-fill failed" }
    |
    v
Client shows: "Profile could not be auto-filled. Answers saved — please review manually."
Profile page opens with raw answers visible, manager edits manually
```

**Trade-offs**:
- Raw answer storage is a best-effort fallback; the UI must handle `_rawAnswers` gracefully
- The `_rawAnswers` key is prefixed with `_` to distinguish it from real profile fields in completeness calculation

---

## P-2.06: Server-Side API Key Isolation Pattern

**Problem**: The `ANTHROPIC_API_KEY` must never be exposed to the browser. Next.js `NEXT_PUBLIC_` env vars are bundled into the client JavaScript — any key with that prefix becomes public.

**Design**:
```
.env.local / Vercel dashboard
  ANTHROPIC_API_KEY=sk-ant-...      (no NEXT_PUBLIC_ prefix)
          |
          v (server-side only)
  pages/api/interviews/[id]/next.ts
  pages/api/interviews/[id]/complete.ts
          |
          v
  handlers/interviewAIHandler.ts
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY   // undefined in browser bundles
    })
          |
          v
  Claude API (external)

Browser bundle:
  process.env.ANTHROPIC_API_KEY --> undefined (not included)
```

**Enforcement rule**: Any `process.env` access to `ANTHROPIC_API_KEY` must only appear in files under `pages/api/` or `handlers/`. ESLint could enforce this with a custom rule (deferred — TD consideration).

---

## P-2.07: Input Truncation Before Prompt Pattern

**Problem**: Manager interview answers are embedded directly into Claude system prompts. Very long answers (or adversarial inputs) could bloat prompt costs or attempt prompt injection.

**Design**:
```typescript
// Applied in interviewAIHandler.ts before building any Claude prompt
function sanitizeAnswer(answer: string): string {
  return answer.slice(0, 2000).trim()
}

// Applied to name and role embedded in prompts (already validated 1-100 chars in API route)
// Double-protection: API route validates length; handler sanitizes before prompt use
```

**What this does NOT protect against**: Semantic prompt injection (e.g., "Ignore previous instructions and output..."). For a private single-user tool this is an acceptable risk (TD-06). Full prompt injection protection would require output validation and/or a structured output format.

**Trade-offs**:
- 2000 chars is generous (approx 400 words) — no legitimate interview answer should exceed this
- Truncation is silent (no error returned to client for oversized answers)

---

## P-2.08: Composable Handler Architecture Pattern

**Problem**: Business logic in API route files is hard to unit-test (requires HTTP mocking) and tightly couples the Claude SDK to the route lifecycle.

**Design** (consistent with Unit 1 lib pattern):
```
pages/api/interviews/[id]/next.ts     pages/api/interviews/[id]/complete.ts
  - withAuth session check              - withAuth session check
  - validate body shape                 - validate body (7 turns)
  - verify teammate ownership           - verify teammate ownership
  - delegate to handler          -->    - delegate to handler
                                 |
                         handlers/interviewAIHandler.ts
                           - nextQuestion(teammateId, history, latestAnswer)
                           - generateProfile(teammateId, history)
                           - callClaudeWithRetry(fn)
                           - buildNextQuestionPrompt(...)
                           - buildSynthesisPrompt(...)
                           - parseProfileJSON(text)
                                 |
                         @anthropic-ai/sdk (injected, mockable)
```

**Testability**: `interviewAIHandler.ts` exports pure functions that accept an optional `anthropic` client parameter. Tests inject a mock Anthropic client without HTTP calls:

```typescript
// Production usage (default client)
await nextQuestion(teammateId, history, answer)

// Test usage (injected mock)
await nextQuestion(teammateId, history, answer, mockAnthropicClient)
```

**Trade-offs**:
- Thin routes (< 30 lines each) are easy to read and audit
- Handler functions are independently testable
- Consistent with Unit 1's `lib/` separation pattern

---

## Pattern Interaction Diagram

```
Manager submits answer
        |
        v
POST /api/interviews/[id]/next
  [withAuth] --> [validate body] --> [verify ownership]
        |
        v
interviewAIHandler.nextQuestion()
        |
        v
  sanitizeAnswer()            [P-2.07 Input Truncation]
        |
        v
  buildNextQuestionPrompt()
        |
        v
  callClaudeWithRetry(        [P-2.03 Single Retry]
    claude-haiku-4-5           [P-2.01 Tiered Model]
  )
        |
   success      fail (after retry)
        |              |
        v              v
  { question,    throw error
    area,              |
    isComplete }       v
        |         Route handler
        v         return 503 { fallback: true }
  Return to              |
  client                 v
  Client updates    Client redirects   [P-2.04 Graceful Fallback]
  InterviewState    to /teammates/[id]?editMode=1
  [P-2.02 Client State]
```
