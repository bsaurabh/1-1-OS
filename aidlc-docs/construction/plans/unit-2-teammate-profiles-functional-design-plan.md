# Unit 2: Teammate Profiles — Functional Design Plan

**Unit**: Unit 2: Teammate Profiles
**Stories**: US-03 (AI onboarding interview), US-04 (Review and edit profile)
**Date**: 2026-03-01

---

## Execution Checklist

- [x] Step 1: Analyze unit context (unit-of-work.md, story-map, component-methods, schema)
- [x] Step 2: Clarifying questions presented to user
- [x] Step 3: Answers collected and analyzed for ambiguity
- [x] Step 4: Generate domain-entities.md
- [x] Step 5: Generate business-logic-model.md
- [x] Step 6: Generate business-rules.md
- [x] Step 7: Generate frontend-components.md
- [x] Step 8: Present completion message and await approval

---

## Context Summary

**Unit purpose**: Enable a manager to create a teammate record and build their profile through an AI-led conversational interview (Claude API), with fallback to a manual form. After the interview, the manager can review and inline-edit any profile field.

**Prisma model**: `Teammate { id, managerId, name, role, profile Json?, createdAt, updatedAt }`

**Profile fields** (from US-03 acceptance criteria):
- Role (already in Teammate model as `role: String`)
- Strengths
- Growth areas
- Aspirations
- KPIs
- Behavioral tendencies
- Feedback style
- Motivation drivers

**Key components**:
- `TeammateComponent` — CRUD (create, get, list, update, delete)
- `InterviewAIHandler` — startInterview, nextQuestion, generateProfile, handleFailure

**API Routes to implement**:
- `GET /api/teammates`
- `POST /api/teammates`
- `GET /api/teammates/[id]`
- `PATCH /api/teammates/[id]`
- `DELETE /api/teammates/[id]`
- `POST /api/interviews/[teammateId]/next`
- `POST /api/interviews/[teammateId]/complete`

---

## Clarifying Questions

**Instructions**: Please provide your answer after each `[Answer]:` tag.

---

### Q1 — Interview Conversation State: Where is the conversation history stored?

During the AI interview, each call to `POST /api/interviews/[teammateId]/next` needs to know all prior Q&A pairs to give Claude context. How should this state be managed?

**A)** Client-side — the frontend accumulates the full conversation array and sends it with every request. Server is stateless. Simple but client payload grows with each turn.

**B)** Server-side in database — a new `InterviewSession` table stores conversation history. Server fetches prior turns by `teammateId`. Cleaner API but requires schema addition (no migration needed yet — new table).

**C)** Server-side in the existing Teammate record — store partial interview state in the `profile` JSONB field under an `_interviewState` key. No new table, but mixes interview state with profile data.

[Answer]: A

---

### Q2 — Interview Question Count: Fixed or dynamic?

How many questions does the interview consist of?

**A)** Fixed set — exactly one question per profile area (8 areas = 8 questions). Order is predetermined. Claude is prompted to ask about one area per turn.

**B)** Dynamic — Claude decides how many follow-up questions to ask based on answer quality. Claude signals completion with a special response token when it judges all areas covered. Could be 6–15 questions.

**C)** Fixed minimum, dynamic maximum — the interview covers all 8 areas (guaranteed), but Claude may ask 1–2 follow-up questions per area if the answer is vague. Completion is triggered when all 8 areas have at least one answer.

[Answer]: A

---

### Q3 — Profile Synthesis: When and how is the profile generated from answers?

After all interview questions are answered, how is the structured profile assembled?

**A)** Single synthesis call — all Q&A pairs are sent to Claude in one final prompt. Claude outputs a JSON object with all 8 profile fields populated. `POST /api/interviews/[teammateId]/complete` triggers this.

**B)** Progressive synthesis — each answer is immediately parsed and saved into the relevant `profile` field after each `next` call. No final synthesis step needed. `complete` just finalizes status.

**C)** Server-side rule-based extraction — no extra Claude call. The server maps each answer to its profile field based on question index. Simpler, but less intelligent field population.

[Answer]: A

---

### Q4 — Claude Model for Interview: Which Claude model to use?

**A)** `claude-haiku-4-5-20251001` — fast and cheap, suitable for the back-and-forth interview flow where latency matters most.

**B)** `claude-sonnet-4-6` — more capable, produces higher-quality questions and profile synthesis. Slightly higher latency and cost.

**C)** `claude-haiku-4-5-20251001` for nextQuestion, `claude-sonnet-4-6` for the final generateProfile synthesis call — balances speed during interview with quality at synthesis.

[Answer]: C

---

### Q5 — Profile Completeness: Which fields count toward the "5 fields" threshold?

US-04 states: "If fewer than 5 fields populated, show a warning banner." Which fields are counted?

**A)** All 8 profile JSONB fields count (strengths, growthAreas, aspirations, kpis, behavioralTendencies, feedbackStyle, motivationDrivers, plus role which is always set). A field counts as "populated" if it is a non-empty string.

**B)** Only the 7 JSONB-stored fields count (role is always set on the Teammate record and is excluded). A field is populated if non-empty string.

**C)** A weighted count — some fields (role, strengths, growthAreas) are mandatory (must all be set), then 2 more from the remaining 5. Banner shown if mandatory fields are missing OR fewer than 2 optional fields are set.

[Answer]: A

---

### Q6 — Teammate Deletion Behavior: What gets cascade-deleted?

When `DELETE /api/teammates/[id]` is called, what is deleted beyond the Teammate record itself?

**A)** Cascade all related data — meetings, patterns, commitments, analysis jobs are all deleted. The Prisma schema already has `onDelete: Cascade` on all relations.

**B)** Soft delete — set a `deletedAt` timestamp on the Teammate. All queries filter `deletedAt IS NULL`. Data is preserved for potential recovery.

**C)** Confirmation gate only — the API requires a `confirm: true` body parameter to execute deletion. Without it, returns a 409 with a count of related records that would be deleted.

[Answer]: A

---

### Q7 — Manual Fallback Form: What fields does the manual form include when Claude is unavailable?

When `InterviewAIHandler.handleFailure()` is triggered because Claude API is unreachable:

**A)** All 8 profile fields presented as text inputs at once (name, role pre-filled; strengths, growthAreas, aspirations, kpis, behavioralTendencies, feedbackStyle, motivationDrivers as optional textareas). User fills what they know and saves.

**B)** Progressive manual form — only the most critical 3 fields shown initially (strengths, growthAreas, aspirations). User can expand to see all 8.

**C)** Redirect to profile edit page — no separate fallback form. When Claude fails, the teammate is created with just name + role, and the manager is taken to the profile edit page (US-04 flow) to fill in details.

[Answer]: C

---

### Q8 — Profile Edit UX: Inline edit or edit mode?

US-04 says "click on any field and it becomes editable inline." How should this work technically?

**A)** True inline editing — each field is a `<span>` that becomes a `<textarea>` when clicked. `PATCH /api/teammates/[id]` is called individually per field on blur. No "Save All" button — each field saves independently.

**B)** Section edit mode — clicking any field activates an "edit mode" for the whole profile section. All fields become editable simultaneously. A single "Save" button PATCHes all changed fields at once.

**C)** Modal edit form — clicking a field opens a modal with that field pre-filled. Save closes the modal and PATCHes just that field.

[Answer]: B

---

## Artifacts to Generate

Once answers are received, the following files will be created:

```
aidlc-docs/construction/unit-2-teammate-profiles/functional-design/
├── domain-entities.md          — Teammate, ProfileFields type, InterviewQuestion type, InterviewSession (client-side structure)
├── business-logic-model.md     — Interview flow, profile synthesis, CRUD operations, completeness check logic
├── business-rules.md           — Validation rules, constraints, authorization rules, interview rules
└── frontend-components.md      — TeammateList, TeammateCard, AddTeammateModal, InterviewChat, ProfileView, ProfileEditForm
```
