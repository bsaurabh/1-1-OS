# Business Rules — Unit 2: Teammate Profiles

**Date**: 2026-03-01
**Unit**: Unit 2: Teammate Profiles
**Stories**: US-03, US-04

---

## Rule Groups

1. Teammate Creation
2. Interview Flow
3. Profile Synthesis
4. Profile Completeness
5. Profile Editing
6. Authorization & Data Isolation
7. Deletion

---

## Group 1: Teammate Creation

**BR-2.01 — Name is required**
The `name` field must be provided and must not be empty. Minimum length: 1 character. Maximum length: 100 characters.

**BR-2.02 — Role is required**
The `role` field must be provided and must not be empty. Minimum length: 1 character. Maximum length: 100 characters.

**BR-2.03 — Manager identity from session only**
`managerId` is derived exclusively from the authenticated session (JWT). It must never be accepted from the request body.

**BR-2.04 — No limit on teammate count**
A manager may create an unlimited number of teammates. No cap is enforced.

**BR-2.05 — Profile starts null**
A newly created Teammate always has `profile = null`. The profile is populated only after interview completion or manual editing.

---

## Group 2: Interview Flow

**BR-2.06 — Fixed 7-question interview**
The interview consists of exactly 7 questions, one per JSONB profile area. The fixed order is:
1. `strengths`
2. `growthAreas`
3. `aspirations`
4. `kpis`
5. `behavioralTendencies`
6. `feedbackStyle`
7. `motivationDrivers`

`role` is captured at teammate creation and is NOT part of the interview.

**BR-2.07 — Client holds all conversation history**
The server is stateless with respect to interview progress. The client must send the full `conversationHistory` array with every `POST /api/interviews/[id]/next` request. The server does not store partial interview state.

**BR-2.08 — Any answer is accepted**
Answers are not validated for content length or quality. An empty string is a valid answer. Claude will still generate the next contextual question.

**BR-2.09 — Claude Haiku for question generation**
`POST /api/interviews/[id]/next` always calls `claude-haiku-4-5-20251001` for generating interview questions. This model is not configurable at runtime.

**BR-2.10 — Completion signal after answer 7**
When the server receives a `POST /api/interviews/[id]/next` with `conversationHistory` containing 7 turns (all answered), it returns `{ isComplete: true }` without generating another question. No 8th question is asked.

**BR-2.11 — Claude failure triggers fallback redirect**
If any Claude API call during the interview throws an error (network error, 5xx, timeout), the server responds with HTTP 503 and `{ fallback: true }`. The client navigates to the profile edit page in edit mode. The partially completed interview answers are lost (no partial state recovery).

**BR-2.12 — Fallback message is prescribed**
When the fallback is triggered, the exact UI message must be: "AI interview unavailable. You can fill in the profile manually."

---

## Group 3: Profile Synthesis

**BR-2.13 — Claude Sonnet for profile synthesis**
`POST /api/interviews/[id]/complete` calls `claude-sonnet-4-6` for profile synthesis. This is separate from the question-generation model.

**BR-2.14 — All 7 turns required for synthesis**
The `conversationHistory` sent to `POST /api/interviews/[id]/complete` must contain exactly 7 turns (one per profile area). The server validates this count and returns `400 Bad Request` if the count does not match.

**BR-2.15 — Profile synthesis output is a JSON object**
Claude Sonnet is prompted to return a JSON object with the 7 profile field keys. The server parses the JSON and writes it to `Teammate.profile`.

**BR-2.16 — Null values for insufficient answers**
If the manager's answer for a profile area was insufficient (empty or nonsensical), Claude may return `null` for that field in the synthesized JSON. `null` is stored as-is in the JSONB and counts as unpopulated for completeness purposes.

**BR-2.17 — JSON parse failure fallback**
If Claude's synthesis response is not valid JSON, the server attempts to extract a JSON block via regex. If extraction fails, the raw Q&A array is stored as `{ _rawAnswers: conversationHistory }` in `Teammate.profile`, and the API returns a partial success with a warning flag.

**BR-2.18 — Profile write is the final step**
Profile persistence (`PATCH Teammate.profile`) is the last operation in the interview completion flow. If the write fails (DB error), the synthesis result is not returned to the client; the client must retry `POST /api/interviews/[id]/complete`.

---

## Group 4: Profile Completeness

**BR-2.19 — Completeness counts 8 fields**
Profile completeness is calculated across 8 fields:
- `role` (top-level column, always populated after creation = always 1)
- 7 JSONB fields: `strengths`, `growthAreas`, `aspirations`, `kpis`, `behavioralTendencies`, `feedbackStyle`, `motivationDrivers`

**BR-2.20 — Populated definition**
A field is "populated" if it is a non-empty, non-whitespace string. `null`, `undefined`, `""`, and `"   "` all count as unpopulated.

**BR-2.21 — Warning threshold is 5**
If `countPopulatedFields(teammate) < 5`, the "Profile incomplete" warning is shown. At 5 or more populated fields, no warning is shown.

**BR-2.22 — Completeness is computed, not stored**
`profileCompleteness` is computed at read time (on GET /api/teammates and GET /api/teammates/[id]). It is not stored in the database.

---

## Group 5: Profile Editing

**BR-2.23 — All fields are editable**
All profile JSONB fields (`strengths`, `growthAreas`, `aspirations`, `kpis`, `behavioralTendencies`, `feedbackStyle`, `motivationDrivers`) and both top-level text fields (`name`, `role`) are editable via `PATCH /api/teammates/[id]`.

**BR-2.24 — Partial PATCH only**
The PATCH request only needs to include the fields that changed. Fields omitted from the request body retain their existing values. The server merges the new profile values into the existing `Teammate.profile` JSONB.

**BR-2.25 — Empty string clears a field**
Setting a profile field to an empty string `""` is valid and results in that field being stored as `""` (treated as unpopulated for completeness calculation).

**BR-2.26 — Name and role remain required**
If `name` or `role` is included in the PATCH body, they must still satisfy BR-2.01 and BR-2.02 (non-empty, max 100 chars). Setting them to empty string returns `400 Bad Request`.

**BR-2.27 — Section edit mode**
The edit UI activates edit mode for the entire profile at once (not per-field). All changed fields are sent in a single PATCH request when the manager clicks "Save".

**BR-2.28 — Success toast on save**
After a successful PATCH, the UI displays a transient toast: "Profile saved."

---

## Group 6: Authorization & Data Isolation

**BR-2.29 — Authentication required**
All seven API routes (`GET/POST /api/teammates`, `GET/PATCH/DELETE /api/teammates/[id]`, `POST /api/interviews/[id]/next`, `POST /api/interviews/[id]/complete`) require a valid session cookie. Unauthenticated requests receive `401 Unauthorized`.

**BR-2.30 — Manager can only access own teammates**
All queries filter by `managerId` derived from the session. A manager cannot access, modify, or delete a teammate that belongs to another manager.

**BR-2.31 — 404 for unauthorized teammates (not 403)**
If a manager requests a teammate that exists but belongs to another manager, the server returns `404 Not Found` (not `403 Forbidden`). This prevents enumeration of other managers' teammates by ID.

**BR-2.32 — managerId never trusted from client**
`managerId` is never accepted as a request parameter (query string or body). It is always read from the verified JWT session.

---

## Group 7: Deletion

**BR-2.33 — Deletion is permanent**
`DELETE /api/teammates/[id]` permanently removes the teammate record and all related data. There is no undo.

**BR-2.34 — Cascade delete scope**
Deleting a teammate automatically deletes (via Prisma `onDelete: Cascade`):
- All `Meeting` records for this teammate
- All `Pattern` records for this teammate
- All `Commitment` records for this teammate
- All `AnalysisJob` records linked to those meetings

**BR-2.35 — Authorization check before deletion**
The server verifies `managerId` ownership before executing the delete. An unauthorized delete attempt returns `404`.

**BR-2.36 — Delete returns 204**
A successful delete returns HTTP `204 No Content` with no body.

---

## Business Rules Reference Table

| Rule ID | Group             | Summary                                                           |
|---------|-------------------|-------------------------------------------------------------------|
| BR-2.01 | Creation          | name required, 1–100 chars                                        |
| BR-2.02 | Creation          | role required, 1–100 chars                                        |
| BR-2.03 | Creation          | managerId from session only                                       |
| BR-2.04 | Creation          | No limit on teammate count                                        |
| BR-2.05 | Creation          | New teammate profile starts null                                  |
| BR-2.06 | Interview         | Fixed 7-question interview in defined area order                  |
| BR-2.07 | Interview         | Client sends full conversation history each request               |
| BR-2.08 | Interview         | Any answer accepted (no content validation)                       |
| BR-2.09 | Interview         | Claude Haiku for question generation                              |
| BR-2.10 | Interview         | isComplete returned after 7th answer                              |
| BR-2.11 | Interview         | Claude failure → 503 + fallback flag                              |
| BR-2.12 | Interview         | Prescribed fallback message                                       |
| BR-2.13 | Synthesis         | Claude Sonnet for profile synthesis                               |
| BR-2.14 | Synthesis         | Exactly 7 turns required for complete call                        |
| BR-2.15 | Synthesis         | Synthesis output is JSON object                                   |
| BR-2.16 | Synthesis         | null allowed per field for insufficient answers                   |
| BR-2.17 | Synthesis         | JSON parse failure → store raw Q&A as fallback                    |
| BR-2.18 | Synthesis         | Profile write is final step; failure requires retry               |
| BR-2.19 | Completeness      | 8 fields counted (role + 7 JSONB)                                 |
| BR-2.20 | Completeness      | Populated = non-empty, non-whitespace string                      |
| BR-2.21 | Completeness      | Warning if < 5 fields populated                                   |
| BR-2.22 | Completeness      | Completeness computed at read time, not stored                    |
| BR-2.23 | Editing           | All 9 fields editable (role, name, 7 JSONB)                       |
| BR-2.24 | Editing           | Partial PATCH; untouched fields retain existing values            |
| BR-2.25 | Editing           | Empty string clears a JSONB field                                 |
| BR-2.26 | Editing           | name and role still required on PATCH                             |
| BR-2.27 | Editing           | Section edit mode: whole profile, single Save                     |
| BR-2.28 | Editing           | Success toast: "Profile saved."                                   |
| BR-2.29 | Authorization     | All routes require authentication                                 |
| BR-2.30 | Authorization     | Manager accesses only own teammates                               |
| BR-2.31 | Authorization     | 404 for unauthorized teammate (not 403)                           |
| BR-2.32 | Authorization     | managerId never trusted from client                               |
| BR-2.33 | Deletion          | Deletion is permanent                                             |
| BR-2.34 | Deletion          | Cascade: meetings, patterns, commitments, jobs                    |
| BR-2.35 | Deletion          | Authorization check before delete                                 |
| BR-2.36 | Deletion          | Delete returns 204 No Content                                     |
