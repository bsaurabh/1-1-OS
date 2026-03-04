# NFR Requirements — Unit 2: Teammate Profiles

**Date**: 2026-03-01
**Unit**: Unit 2: Teammate Profiles
**Stories**: US-03, US-04

---

## NFR-2.1: Performance

### CRUD Operations (Teammate list, get, create, update, delete)

| Operation | Target | Rationale |
|-----------|--------|-----------|
| GET /api/teammates (list) | p95 < 300ms | Simple DB query, ordered by name |
| GET /api/teammates/[id] (detail) | p95 < 300ms | Single row fetch with JSONB |
| POST /api/teammates (create) | p95 < 400ms | Single insert |
| PATCH /api/teammates/[id] (update) | p95 < 400ms | Single update with JSONB merge |
| DELETE /api/teammates/[id] | p95 < 500ms | Cascade delete across multiple tables |

All targets consistent with Unit 1 auth endpoint baselines (< 500ms p95).

### Claude API Calls (Interview + Synthesis)

| Operation | Target | Notes |
|-----------|--------|-------|
| POST /api/interviews/[id]/next (Haiku) | p95 < 5s end-to-end | Includes network, Haiku inference, response. Haiku is very fast (~1–2s typical). |
| POST /api/interviews/[id]/complete (Sonnet) | p95 < 15s end-to-end | Sonnet synthesis of 7 Q&A pairs. Longer prompt, larger response. |
| Timeout threshold | 30s hard cutoff | Vercel function `maxDuration: 30`. Requests exceeding 30s trigger fallback. |

**Delivery mode**: Non-streaming. Full Claude response returned as JSON. Client shows spinner during inference.

### Page Load

| Page | Target |
|------|--------|
| Dashboard (SSR) | TTI < 3s (consistent with Unit 1 targets) |
| Profile page (SSR) | TTI < 3s |
| Interview page (SSR) | TTI < 2s (no heavy initial data) |

---

## NFR-2.2: Reliability

### Claude API Retry Policy

- **Strategy**: Single retry on any transient failure (network error, 529 overloaded, 5xx).
- **Retry delay**: 1 second fixed wait before retry.
- **On second failure**: Return HTTP 503 `{ fallback: true }` immediately — no further retries.
- **Non-retryable errors**: 400 (bad request to Claude), 401 (invalid API key) — fail immediately without retry.

```
Request → Claude
  Success → return response
  Failure (transient) → wait 1s → retry
    Retry success → return response
    Retry failure → return 503 { fallback: true }
```

### Fallback Behavior

- Any Claude failure (after retry exhausted) returns `{ fallback: true, message: "AI interview unavailable. You can fill in the profile manually." }`.
- Client redirects to `/teammates/[id]` with `?editMode=1`.
- Manager completes profile manually. No data loss (teammate record was created before interview started).

### Profile Synthesis Failure

- If Claude Sonnet returns malformed JSON, server attempts regex extraction of JSON block.
- If extraction fails, stores raw Q&A as `{ _rawAnswers: [...] }` in `Teammate.profile`.
- Returns partial success to client with `warning: "Profile auto-fill failed — answers saved, please review manually."`

### CRUD Error Handling

- All DB errors return `500 Internal Server Error` with `{ error: "Something went wrong. Please try again." }` (consistent with Unit 1 `INTERNAL_ERROR` constant).
- Authorization failures (wrong manager) return `404 Not Found`.

---

## NFR-2.3: Security

### Claude API Key

- Stored as `ANTHROPIC_API_KEY` environment variable (server-side only, never exposed to client).
- Accessed via `process.env.ANTHROPIC_API_KEY` in server-side API routes and handlers only.
- Never included in Next.js `NEXT_PUBLIC_` prefix (would expose to browser bundle).

### Input Handling

- Interview answers are sent to Claude as part of the system prompt. Special characters and long inputs must not be able to manipulate the prompt structure.
- Answer length soft cap: 1000 characters (enforced client-side as a UX guard). Server does not enforce a hard limit but truncates at 2000 characters before passing to Claude prompt.
- `name` and `role` are validated server-side (1–100 chars) before being embedded in Claude prompts.

### Authorization

- All 7 API routes enforce `withAuth` (JWT session validation). Unauthenticated requests → 401.
- `managerId` is always read from session, never from request body or query params.
- Cross-manager access returns 404 (not 403) to prevent teammate ID enumeration.

### Data Isolation

- Prisma queries always include `where: { managerId }` filter.
- The existing RLS policies on the `teammates` table provide defense-in-depth (protects against direct DB access).

### No New Security Risks

- No file uploads in this unit (introduced in Unit 3).
- No public-facing endpoints — all routes require authentication.
- Rate limiting remains deferred (TD-01, consistent with Unit 1 decision).

---

## NFR-2.4: Scalability

### Interview Statelessness

- Interview state is held entirely on the client (React state + `conversationHistory` array).
- Server is fully stateless for interview operations — no session affinity required.
- Each `POST /api/interviews/[id]/next` is an independent, self-contained serverless function invocation.
- This design scales horizontally without modification.

### Claude API Concurrency

- Claude API calls are independent per manager session.
- No shared state or queuing needed within Unit 2 (unlike the async analysis queue in Unit 3).
- Vercel concurrent function execution handles multiple simultaneous managers.

### Database

- No new tables added in Unit 2 (uses existing `teammates` schema).
- The `profile` JSONB field has no size limit enforcement beyond PostgreSQL's JSONB max (~1GB, effectively unlimited for text profiles).
- No indexes added beyond the existing `managerId` FK index — sufficient for expected teammate counts (< 100 per manager for a PoC).

---

## NFR-2.5: Availability

- Inherits Unit 1 availability targets:
  - Vercel: 99.99% uptime SLA
  - Supabase: 99.9% uptime SLA
- Claude API availability is not covered by an SLA but is handled gracefully via the fallback flow.
- CRUD operations (list, get, update, delete) remain available even when Claude API is down.

---

## NFR-2.6: Maintainability

### Claude Prompt Management

- Claude system prompts are defined as string constants in `handlers/interviewAIHandler.ts`.
- Prompts are not stored in the database — they are code artifacts, versioned with the codebase.
- Model IDs are defined as named constants, not inline strings, to allow easy future model upgrades:
  ```typescript
  const INTERVIEW_MODEL = 'claude-haiku-4-5-20251001'
  const SYNTHESIS_MODEL = 'claude-sonnet-4-6'
  ```

### Code Structure

- `handlers/interviewAIHandler.ts` encapsulates all Claude API calls for Unit 2.
- API routes (`pages/api/interviews/`) are thin — they validate auth, parse body, delegate to the handler.
- `TeammateComponent` business logic lives in a service-layer file (consistent with Unit 1 `lib/` pattern).

### Testing

- `interviewAIHandler.ts` is testable with mocked Anthropic SDK responses.
- All Claude calls should be injectable (accept an optional `anthropic` client param for tests).
- Profile completeness calculation is a pure function — trivially unit-testable.

### Logging

- Console logging only (consistent with Unit 1 decision).
- Log Claude API errors with status code and message.
- Log retry attempts with timestamp.
- Do NOT log interview answers or profile content (PII — consistent with TD-02 tracking).

---

## NFR-2.7: Usability

### Interview UX

- Spinner shown while waiting for Claude Haiku (typically 1–2s).
- Progress indicator (e.g., "Question 3 of 7") displayed throughout interview.
- Submit button disabled during in-flight Claude request to prevent double-submission.
- Answer textarea auto-focuses after each question is received.

### Profile Edit UX

- Edit mode activated by a single "Edit Profile" button click.
- All fields editable simultaneously (section edit mode).
- "Save" and "Cancel" buttons always visible while in edit mode.
- Success toast displayed for 3 seconds after save.
- Unsaved changes not warned on navigation (acceptable for PoC — TD consideration).

### Accessibility

- Consistent with Unit 1 baseline: semantic HTML, labels on all form inputs, keyboard-navigable.
- Interview textarea has `aria-label="Your answer"`.
- Profile fields have descriptive labels (e.g., "Strengths", "Growth Areas").

---

## Technical Debt Additions (Unit 2)

| ID | Item | Priority |
|----|------|----------|
| TD-06 | No prompt injection protection (answers embedded in Claude prompts) | MEDIUM — low risk for private single-user tool |
| TD-07 | Interview state lost on page refresh (client-side only) | LOW — acceptable for PoC; could add IndexedDB persistence later |
| TD-08 | No Claude API cost monitoring or budget alerts | LOW — add before public launch |
| TD-09 | Unsaved profile edit changes not warned on navigation | LOW — acceptable for PoC |

---

## NFR Summary Table

| Category | Requirement | Target / Decision |
|----------|-------------|-------------------|
| Performance | CRUD endpoints | p95 < 500ms |
| Performance | Claude Haiku (next question) | p95 < 5s |
| Performance | Claude Sonnet (synthesis) | p95 < 15s |
| Performance | Claude timeout | 30s hard cutoff |
| Performance | Page TTI | < 3s |
| Reliability | Claude retry | 1 retry, 1s delay |
| Reliability | Fallback on Claude failure | 503 + redirect to edit |
| Security | ANTHROPIC_API_KEY | Server-side env var only |
| Security | Input truncation | 2000 char server cap before prompt |
| Security | Auth | withAuth on all 7 routes |
| Security | Rate limiting | Deferred (TD-01) |
| Scalability | Interview state | Client-side (stateless server) |
| Availability | Uptime | Inherits Unit 1 (Vercel + Supabase SLAs) |
| Maintainability | Prompt management | Constants in handler file |
| Maintainability | Model IDs | Named constants |
| Maintainability | Logging | Console only, no PII |
| Usability | Interview delivery | Non-streaming (spinner) |
| Usability | Edit mode | Section edit, single Save |
