# Business Logic Model — Unit 2: Teammate Profiles

**Date**: 2026-03-01
**Unit**: Unit 2: Teammate Profiles
**Stories**: US-03, US-04

---

## Flow Overview

```
US-03: Add Teammate + AI Interview
  1. Create Teammate (name + role)
  2. Start Interview (first question from Claude Haiku)
  3. Answer Q&A Loop (7 turns, client accumulates history)
  4. Complete Interview (Claude Sonnet synthesizes ProfileFields)
  5. Save Profile → redirect to Profile View

US-04: Review and Edit Profile
  1. Load Teammate detail
  2. Enter Edit Mode (whole profile editable at once)
  3. Save changes (PATCH with partial ProfileFields)
  4. Show completeness warning if < 5 fields populated
```

---

## Flow 1: Create Teammate

**Trigger**: Manager clicks "Add Teammate" and submits the modal form.

**Inputs**: `name` (string), `role` (string)
**Actor**: Authenticated manager (managerId from session)

**Steps**:
1. Validate: `name` non-empty, 1–100 characters.
2. Validate: `role` non-empty, 1–100 characters.
3. Create `Teammate` record via Prisma:
   ```typescript
   prisma.teammate.create({
     data: { managerId, name, role, profile: null }
   })
   ```
4. Return `{ id, name, role, createdAt }`.
5. Frontend navigates to the interview view for the new `teammateId`.

**Error cases**:
- Validation failure → `400 Bad Request` with field errors.
- DB error → `500 Internal Server Error` (generic).

---

## Flow 2: Start Interview (First Question)

**Trigger**: Frontend calls `POST /api/interviews/[teammateId]/next` with empty `conversationHistory` and no `latestAnswer`.

**Inputs**: `teammateId` (URL param), `conversationHistory: []`
**Actor**: Authenticated manager

**Steps**:
1. Verify manager owns `teammateId` → fetch `Teammate` record, confirm `managerId` match.
2. Since `conversationHistory` is empty → this is question 1.
3. Determine `currentArea = ProfileArea.STRENGTHS` (index 1, fixed order).
4. Build system prompt for Claude Haiku:
   ```
   You are conducting a brief onboarding interview with a design manager about their direct report.
   You are gathering information to build a coaching profile.

   Direct report name: {teammateName}
   Role: {role}

   You are on question 1 of 7. The topic is: STRENGTHS.
   Ask one natural, conversational question to help the manager describe this person's key strengths.
   Keep the question concise (1–2 sentences). Do not explain what you will do next.
   ```
5. Call Claude Haiku: `claude-haiku-4-5-20251001`, `max_tokens: 200`.
6. Return:
   ```typescript
   { question: "<Claude's question>", questionIndex: 1, area: "strengths", isComplete: false }
   ```

---

## Flow 3: Next Question (Interview Q&A Loop)

**Trigger**: Manager submits an answer; frontend appends the answered turn to `turns[]` and calls `POST /api/interviews/[teammateId]/next`.

**Inputs**:
```typescript
{
  conversationHistory: ConversationTurn[],  // All answered turns so far
  latestAnswer: string                       // The manager's answer to the current question
}
```

**Steps**:
1. Verify manager owns `teammateId`.
2. Determine next question index: `conversationHistory.length + 1` (because the latest answer has not yet been appended server-side — the server appends it to form the full history).
3. **If `nextIndex === 8`**: All 7 answers received → return `{ isComplete: true, questionIndex: 7 }`.
4. **If `nextIndex <= 7`**: Determine `nextArea` from the fixed order array.
5. Build prompt for Claude Haiku, including all prior Q&A for context:
   ```
   You are conducting an onboarding interview with a design manager about {teammateName} ({role}).

   Conversation so far:
   {conversationHistory.map(t => `Q: ${t.question}\nA: ${t.answer}`).join('\n\n')}

   Manager's latest answer to the previous question: "{latestAnswer}"

   You are now on question {nextIndex} of 7. The topic is: {nextArea}.
   Ask one natural, conversational question about this topic.
   Acknowledge their previous answer briefly (1 sentence) before asking.
   Keep the full response under 3 sentences.
   ```
6. Call Claude Haiku with full conversation context.
7. Return:
   ```typescript
   { question: "<Claude's question>", questionIndex: nextIndex, area: nextArea, isComplete: false }
   ```

**Fixed question order**:
```typescript
const INTERVIEW_AREAS: ProfileArea[] = [
  ProfileArea.STRENGTHS,
  ProfileArea.GROWTH_AREAS,
  ProfileArea.ASPIRATIONS,
  ProfileArea.KPIS,
  ProfileArea.BEHAVIORAL_TENDENCIES,
  ProfileArea.FEEDBACK_STYLE,
  ProfileArea.MOTIVATION_DRIVERS,
]
```

---

## Flow 4: Complete Interview (Profile Synthesis)

**Trigger**: After server returns `{ isComplete: true }`, frontend calls `POST /api/interviews/[teammateId]/complete`.

**Inputs**:
```typescript
{
  conversationHistory: ConversationTurn[]  // All 7 turns with questions and answers
}
```

**Steps**:
1. Verify manager owns `teammateId`.
2. Validate: `conversationHistory.length === 7` (all areas covered).
3. Build synthesis prompt for Claude Sonnet (`claude-sonnet-4-6`):
   ```
   You are a coaching profile synthesizer. Based on the following interview answers from a design manager
   about their direct report {teammateName} (role: {role}), generate a structured profile.

   Interview Q&A:
   {conversationHistory.map(t => `[${t.area}]\nQ: ${t.question}\nA: ${t.answer}`).join('\n\n')}

   Output a JSON object with exactly these keys. Write clear, concise coaching-relevant summaries
   in third person (e.g., "Shows strong systems thinking..."). Each value should be 1–3 sentences.
   Use null for any area where the manager's answer provided insufficient information.

   {
     "strengths": "...",
     "growthAreas": "...",
     "aspirations": "...",
     "kpis": "...",
     "behavioralTendencies": "...",
     "feedbackStyle": "...",
     "motivationDrivers": "..."
   }

   Return ONLY valid JSON. No prose, no markdown, no explanation.
   ```
4. Call Claude Sonnet, parse JSON response.
5. Persist profile:
   ```typescript
   prisma.teammate.update({
     where: { id: teammateId },
     data: { profile: synthesizedProfile }
   })
   ```
6. Return `{ profile: synthesizedProfile }`.
7. Frontend redirects to `/teammates/[id]` (ProfileView page).

**Synthesis failure**:
- If Claude returns malformed JSON → attempt JSON extraction via regex.
- If extraction fails → store raw Q&A in `profile._rawAnswers` (as fallback), return `{ profile: { _rawAnswers: conversationHistory } }`.
- Frontend displays a warning: "Profile could not be auto-filled. Raw answers saved — please edit manually."

---

## Flow 5: Claude API Failure (Fallback)

**Trigger**: Any Claude API call in Flow 2, 3, or 4 throws an error (network timeout, API error, rate limit).

**Behavior**:
- Return HTTP 503 with body `{ fallback: true, message: "AI interview unavailable. You can fill in the profile manually." }`.
- Frontend sets `isFallback = true` in `InterviewSessionState`.
- Frontend navigates to `/teammates/[id]` (ProfileView page in edit mode).
- Manager sees existing profile (empty) in edit mode and can fill fields manually.

**No partial state recovery**: If Claude fails mid-interview, the answers already given are lost (client-side state only). The manager must either retry or fill the profile manually.

---

## Flow 6: List Teammates

**Trigger**: Manager visits the dashboard (`GET /api/teammates`).

**Steps**:
1. Extract `managerId` from session.
2. Query:
   ```typescript
   prisma.teammate.findMany({
     where: { managerId },
     orderBy: { name: 'asc' },
   })
   ```
3. For each teammate, compute `profileCompleteness`:
   ```typescript
   function countPopulatedFields(teammate: Teammate): number {
     let count = 0
     if (teammate.role) count++  // always 1
     const p = teammate.profile as ProfileFields | null
     if (p) {
       const keys: (keyof ProfileFields)[] = [
         'strengths', 'growthAreas', 'aspirations', 'kpis',
         'behavioralTendencies', 'feedbackStyle', 'motivationDrivers'
       ]
       for (const key of keys) {
         if (p[key] && p[key]!.trim().length > 0) count++
       }
     }
     return count
   }
   ```
4. Return `{ teammates: TeammateListItem[] }`.

---

## Flow 7: Get Teammate Detail

**Trigger**: Manager navigates to `/teammates/[id]`.

**Steps**:
1. Extract `managerId` from session, `teammateId` from URL.
2. Query:
   ```typescript
   prisma.teammate.findFirst({
     where: { id: teammateId, managerId }
   })
   ```
3. If not found (or belongs to another manager) → return `404 Not Found`.
4. Compute `profileCompleteness` (same function as Flow 6).
5. Return `TeammateDetailResponse`.

---

## Flow 8: Update Teammate (Profile Edit)

**Trigger**: Manager activates edit mode, makes changes, clicks "Save".

**Inputs**:
```typescript
PATCH /api/teammates/[id]
{
  name?: string
  role?: string
  profile?: Partial<ProfileFields>
}
```

**Steps**:
1. Verify manager owns `teammateId`.
2. Validate:
   - If `name` present: 1–100 characters, non-empty.
   - If `role` present: 1–100 characters, non-empty.
   - `profile` fields: strings (empty string allowed — removes the value).
3. Build update payload:
   ```typescript
   const updateData: Prisma.TeammateUpdateInput = {}
   if (body.name) updateData.name = body.name
   if (body.role) updateData.role = body.role
   if (body.profile) {
     // Merge with existing profile (don't overwrite untouched fields)
     const existingProfile = (await prisma.teammate.findUnique(...)).profile ?? {}
     updateData.profile = { ...existingProfile, ...body.profile }
   }
   ```
4. Execute:
   ```typescript
   prisma.teammate.update({
     where: { id: teammateId },
     data: updateData
   })
   ```
5. Compute `profileCompleteness`, return `UpdateTeammateResponse`.
6. Frontend shows success toast: "Profile saved."

**Profile merge semantics**: The PATCH merges the new `profile` values into the existing JSONB object. Fields not included in the request body retain their existing values.

---

## Flow 9: Delete Teammate

**Trigger**: Manager confirms deletion.

**Steps**:
1. Verify manager owns `teammateId`.
2. Execute:
   ```typescript
   prisma.teammate.delete({ where: { id: teammateId } })
   ```
3. Prisma `onDelete: Cascade` automatically deletes:
   - All `Meeting` records for this teammate
   - All `Pattern` records
   - All `Commitment` records
   - All `AnalysisJob` records (via Meeting cascade)
4. Return `204 No Content`.
5. Frontend redirects to dashboard.

---

## Flow 10: Profile Completeness Warning

**Trigger**: Computed on every GET of teammate list or detail.

**Logic**:
```typescript
const populatedCount = countPopulatedFields(teammate)  // 0-8
const isIncomplete = populatedCount < 5
```

**Display**:
- On dashboard `TeammateCard`: show a subtle indicator (e.g., orange dot or "Incomplete" badge) if `profileCompleteness < 5`.
- On profile page: show banner "Profile incomplete — fill in more details to improve coaching suggestions." if `profileCompleteness < 5`.

---

## Flow Dependency Map

```
Flow 1 (Create) ──────────────────> Flow 2 (Start Interview)
                                          |
                               [Claude OK]  [Claude FAIL]
                                    |            |
                              Flow 3 (Loop)  Flow 5 (Fallback → Edit Mode)
                                    |
                              Flow 4 (Complete + Synthesize)
                                    |
                              Flow 7 (Get Detail / Profile View)
                                    |
                              Flow 8 (Edit / Save)

Flow 6 (List) — Independent, runs on dashboard load
Flow 9 (Delete) — Independent, runs from profile page or list
Flow 10 (Completeness) — Computed inline within Flow 6 and Flow 7
```
