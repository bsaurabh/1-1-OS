# Unit 2: Teammate Profiles — Code Summary

**Unit**: Unit 2: Teammate Profiles
**Stories**: US-03 (AI onboarding interview), US-04 (Review and edit profile)
**Date Completed**: 2026-03-02
**Status**: Complete

---

## Files Created / Modified

### Dependencies & Config

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modified | Added `@anthropic-ai/sdk ^0.39.0` runtime dependency |

### Business Logic & Handler Layer

| File | Action | Description |
|------|--------|-------------|
| `handlers/interviewAIHandler.ts` | Created | Core AI interview logic — `nextQuestion()`, `generateProfile()`, retry, sanitization, prompt builders, JSON parsing |
| `lib/teammates.ts` | Created | Teammate CRUD service — `createTeammate()`, `listTeammates()`, `getTeammate()`, `updateTeammate()` (profile merge), `deleteTeammate()`, `countPopulatedFields()` |

### API Routes

| File | Action | Description |
|------|--------|-------------|
| `pages/api/teammates/index.ts` | Created | `GET` list + `POST` create; validates name/role ≤ 100 chars |
| `pages/api/teammates/[id].ts` | Created | `GET` detail + `PATCH` partial update + `DELETE`; returns 404 for cross-manager access |
| `pages/api/interviews/[teammateId]/next.ts` | Created | `POST` next interview question; `maxDuration: 30`; returns `{ fallback: true }` on Claude error |
| `pages/api/interviews/[teammateId]/complete.ts` | Created | `POST` synthesize profile from 7 turns; `maxDuration: 30`; persists to DB; fallback on error |

### React Components

| File | Action | Description |
|------|--------|-------------|
| `components/teammates/TeammateCard.tsx` | Created | Initials avatar, completeness badge (green/amber), navigates to profile page |
| `components/teammates/TeammateList.tsx` | Created | Grid of TeammateCards, "Add Teammate" button, empty state |
| `components/teammates/AddTeammateModal.tsx` | Created | Name/role form with validation, POST creates teammate, triggers interview navigation |
| `components/teammates/ProfileView.tsx` | Created | View/edit mode for all 7 profile fields + name/role; delete confirmation dialog; PATCH on save |
| `components/interview/InterviewChat.tsx` | Created | AI/user conversation bubbles, progress bar (n/7), Cmd+Enter submit, auto-focus, auto-scroll |

### Pages

| File | Action | Description |
|------|--------|-------------|
| `pages/dashboard/index.tsx` | Modified | Replaced Unit 1 placeholder with TeammateList + AddTeammateModal; loads teammates in GSSP |
| `pages/teammates/[id]/interview.tsx` | Created | 5-state interview machine; client-side history; fallback redirect on Claude errors |
| `pages/teammates/[id]/index.tsx` | Created | Profile view/edit page; save toast; delete redirect; startInEdit from query param |

### Tests

| File | Action | Description |
|------|--------|-------------|
| `handlers/interviewAIHandler.test.ts` | Created | Tests for `nextQuestion` (5 cases) and `generateProfile` (3 cases); Anthropic client DI |
| `lib/teammates.test.ts` | Created | Tests for `countPopulatedFields` (6 cases) and all 5 CRUD functions with mocked Prisma |
| `pages/api/teammates/index.test.ts` | Created | Tests for GET list and POST create — auth, validation, success, error paths |
| `pages/api/teammates/[id].test.ts` | Created | Tests for GET, PATCH, DELETE — auth, validation, 404, success, method guard |
| `pages/api/interviews/[teammateId]/next.test.ts` | Created | Tests for POST next — method guard, auth, ownership, success, Claude fallback |
| `pages/api/interviews/[teammateId]/complete.test.ts` | Created | Tests for POST complete — method guard, auth, ownership, validation, success, warning, Claude fallback |

---

## Key Architectural Decisions

### Interview State is Client-Side
The interview conversation state lives entirely in the browser (`useState<ConversationTurn[]>`). Each POST to `/next` sends the full `conversationHistory` array — the server is stateless and computes `nextIndex = conversationHistory.length + 1`.

### Tiered Claude Model Usage
- **Question generation** (`/next`): `claude-haiku-4-5-20251001` — fast (~1–3 s), cost-efficient
- **Profile synthesis** (`/complete`): `claude-sonnet-4-6` — higher quality reasoning for the final profile

### Single-Retry with Transient Error Detection
`callClaudeWithRetry()` retries once (1 s delay) on HTTP 5xx, 429, 529, or network errors. Non-retriable 4xx errors (except 429) fail immediately. The `/next` and `/complete` API routes return `{ fallback: true }` on any Claude error so the client can redirect gracefully to the manual edit page.

### Profile JSONB Merge
`updateTeammate()` fetches the existing profile first, then spreads: `{ ...existingProfile, ...updates.profile }`. This ensures partial profile updates don't overwrite untouched fields.

### `_rawAnswers` Fallback
When Claude's synthesis response cannot be parsed as JSON, `generateProfile()` stores `{ _rawAnswers: ConversationTurn[] }` in `Teammate.profile` and returns a `warning`. `countPopulatedFields()` explicitly ignores the `_rawAnswers` key so it doesn't inflate the completeness score.

### Authorization Pattern
All routes verify `managerId` from the JWT session and use `getTeammate(managerId, id)` which adds `managerId` to the Prisma `WHERE` clause. Cross-manager access returns 404 (not 403) to prevent teammate ID enumeration.

### Dependency Injection for Tests
`nextQuestion()` and `generateProfile()` accept an optional `client?: Anthropic` parameter. Tests inject a mock client without any HTTP calls. API route tests mock the entire handler module layer (`@/handlers/interviewAIHandler`, `@/lib/teammates`).

---

## Profile Completeness Model

| Field | Source | Counted? |
|-------|--------|----------|
| `role` | Top-level column | Yes (always 1 if non-empty) |
| `strengths` | `profile` JSONB | Yes (if non-empty string) |
| `growthAreas` | `profile` JSONB | Yes |
| `aspirations` | `profile` JSONB | Yes |
| `kpis` | `profile` JSONB | Yes |
| `behavioralTendencies` | `profile` JSONB | Yes |
| `feedbackStyle` | `profile` JSONB | Yes |
| `motivationDrivers` | `profile` JSONB | Yes |
| `_rawAnswers` | `profile` JSONB | **No** (excluded) |

Maximum score: **8**. ProfileView shows "Profile incomplete" banner when score < 5.

---

## data-testid Inventory

| Component | data-testid |
|-----------|-------------|
| TeammateList | `add-teammate-button` |
| TeammateCard | `teammate-card-{id}` |
| AddTeammateModal | `teammate-name-input`, `teammate-role-input`, `start-interview-button` |
| ProfileView | `edit-profile-button`, `profile-save-button`, `profile-cancel-button`, `delete-teammate-button`, `confirm-delete-button`, `profile-incomplete-banner` |
| InterviewChat | `interview-question`, `interview-answer-input`, `submit-answer-button`, `interview-progress`, `synthesizing-message` |
| InterviewPage | `interview-fallback-message` |

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Authenticates calls to Anthropic API |

No new DB migrations — uses `Teammate.profile Json?` column defined in Unit 1 schema.
