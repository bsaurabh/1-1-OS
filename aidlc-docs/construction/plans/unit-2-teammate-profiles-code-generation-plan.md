# Unit 2: Teammate Profiles — Code Generation Plan

**Unit**: Unit 2: Teammate Profiles
**Stories**: US-03 (AI onboarding interview), US-04 (Review and edit profile)
**Date**: 2026-03-01
**Workspace root**: `/Users/saurabhbajaj/Desktop/testproject`

---

## Unit Context

| Item | Detail |
|------|--------|
| Stories | US-03, US-04 |
| Depends on | Unit 1 (auth, Prisma client, withAuth HOC, AppLayout, Prisma schema) |
| New runtime dependency | `@anthropic-ai/sdk ^0.39.0` |
| New env variable | `ANTHROPIC_API_KEY` |
| DB migrations | None — uses existing `teammates` table from Unit 1 |
| Claude models | Haiku (`claude-haiku-4-5-20251001`) for questions; Sonnet (`claude-sonnet-4-6`) for synthesis |

---

## Files to Create / Modify

| # | Path | Action | Stories |
|---|------|--------|---------|
| 1 | `package.json` | Modify — add `@anthropic-ai/sdk` | US-03 |
| 2 | `handlers/interviewAIHandler.ts` | Create | US-03 |
| 3 | `lib/teammates.ts` | Create | US-03, US-04 |
| 4 | `pages/api/teammates/index.ts` | Create | US-03, US-04 |
| 5 | `pages/api/teammates/[id].ts` | Create | US-03, US-04 |
| 6 | `pages/api/interviews/[teammateId]/next.ts` | Create | US-03 |
| 7 | `pages/api/interviews/[teammateId]/complete.ts` | Create | US-03 |
| 8 | `components/teammates/TeammateCard.tsx` | Create | US-03, US-04 |
| 9 | `components/teammates/TeammateList.tsx` | Create | US-03, US-04 |
| 10 | `components/teammates/AddTeammateModal.tsx` | Create | US-03 |
| 11 | `components/teammates/ProfileView.tsx` | Create | US-04 |
| 12 | `components/interview/InterviewChat.tsx` | Create | US-03 |
| 13 | `pages/index.tsx` | Modify — replace placeholder with TeammateList | US-03, US-04 |
| 14 | `pages/teammates/[id]/interview.tsx` | Create | US-03 |
| 15 | `pages/teammates/[id]/index.tsx` | Create | US-04 |
| 16 | `handlers/interviewAIHandler.test.ts` | Create | US-03 |
| 17 | `lib/teammates.test.ts` | Create | US-03, US-04 |
| 18 | `pages/api/teammates/index.test.ts` | Create | US-03, US-04 |
| 19 | `pages/api/teammates/[id].test.ts` | Create | US-03, US-04 |
| 20 | `pages/api/interviews/[teammateId]/next.test.ts` | Create | US-03 |
| 21 | `pages/api/interviews/[teammateId]/complete.test.ts` | Create | US-03 |
| 22 | `aidlc-docs/construction/unit-2-teammate-profiles/code/code-summary.md` | Create | — |

**Total**: 22 steps (15 application files, 6 test files, 1 doc)

---

## Generation Checklist

### Dependencies & Config
- [x] Step 1: Update `package.json` — add `@anthropic-ai/sdk ^0.39.0`

### Business Logic & Handler Layer
- [x] Step 2: Create `handlers/interviewAIHandler.ts` — `nextQuestion()`, `generateProfile()`, `callClaudeWithRetry()`, `sanitizeAnswer()`, `buildNextQuestionPrompt()`, `buildSynthesisPrompt()`, `parseProfileJSON()`
- [x] Step 3: Create `lib/teammates.ts` — `createTeammate()`, `listTeammates()`, `getTeammate()`, `updateTeammate()`, `deleteTeammate()`, `countPopulatedFields()`

### API Routes
- [x] Step 4: Create `pages/api/teammates/index.ts` — `GET` (list) + `POST` (create)
- [x] Step 5: Create `pages/api/teammates/[id].ts` — `GET` (detail) + `PATCH` (update) + `DELETE`
- [x] Step 6: Create `pages/api/interviews/[teammateId]/next.ts` — `POST` next question; `maxDuration: 30`
- [x] Step 7: Create `pages/api/interviews/[teammateId]/complete.ts` — `POST` synthesize profile; `maxDuration: 30`

### React Components
- [x] Step 8: Create `components/teammates/TeammateCard.tsx`
- [x] Step 9: Create `components/teammates/TeammateList.tsx`
- [x] Step 10: Create `components/teammates/AddTeammateModal.tsx`
- [x] Step 11: Create `components/teammates/ProfileView.tsx`
- [x] Step 12: Create `components/interview/InterviewChat.tsx`

### Pages
- [x] Step 13: Modify `pages/dashboard/index.tsx` — replace Unit 1 placeholder dashboard with TeammateList + AddTeammateModal
- [x] Step 14: Create `pages/teammates/[id]/interview.tsx` — interview state machine page
- [x] Step 15: Create `pages/teammates/[id]/index.tsx` — profile view/edit page

### Tests
- [x] Step 16: Create `handlers/interviewAIHandler.test.ts`
- [x] Step 17: Create `lib/teammates.test.ts`
- [x] Step 18: Create `pages/api/teammates/index.test.ts`
- [x] Step 19: Create `pages/api/teammates/[id].test.ts`
- [x] Step 20: Create `pages/api/interviews/[teammateId]/next.test.ts`
- [x] Step 21: Create `pages/api/interviews/[teammateId]/complete.test.ts`

### Documentation
- [x] Step 22: Create `aidlc-docs/construction/unit-2-teammate-profiles/code/code-summary.md`

---

## Story Traceability

| Story | Implementation Steps |
|-------|---------------------|
| US-03 — Add teammate + AI interview | Steps 1–12, 14, 16, 18, 20, 21 |
| US-04 — Review and edit profile | Steps 3–5, 8–9, 11, 13, 15, 17, 19 |

---

## Directory Structure After Unit 2

```
/                                     (workspace root)
├── handlers/                         [NEW directory]
│   ├── interviewAIHandler.ts         [NEW]
│   └── interviewAIHandler.test.ts    [NEW]
├── lib/
│   ├── teammates.ts                  [NEW]
│   ├── teammates.test.ts             [NEW]
│   ├── auth.ts                       (Unit 1)
│   ├── prisma.ts                     (Unit 1)
│   ├── password.ts                   (Unit 1)
│   ├── cookies.ts                    (Unit 1)
│   ├── email.ts                      (Unit 1)
│   ├── apiError.ts                   (Unit 1)
│   └── withAuth.ts                   (Unit 1)
├── components/
│   ├── teammates/                    [NEW directory]
│   │   ├── TeammateCard.tsx          [NEW]
│   │   ├── TeammateList.tsx          [NEW]
│   │   ├── AddTeammateModal.tsx      [NEW]
│   │   └── ProfileView.tsx           [NEW]
│   ├── interview/                    [NEW directory]
│   │   └── InterviewChat.tsx         [NEW]
│   └── AppLayout.tsx                 (Unit 1)
├── pages/
│   ├── index.tsx                     [MODIFIED — dashboard with teammate list]
│   ├── teammates/                    [NEW directory]
│   │   └── [id]/
│   │       ├── interview.tsx         [NEW]
│   │       └── index.tsx             [NEW]
│   ├── api/
│   │   ├── teammates/                [NEW directory]
│   │   │   ├── index.ts              [NEW]
│   │   │   ├── index.test.ts         [NEW]
│   │   │   ├── [id].ts               [NEW]
│   │   │   └── [id].test.ts          [NEW]
│   │   ├── interviews/               [NEW directory]
│   │   │   └── [teammateId]/
│   │   │       ├── next.ts           [NEW]
│   │   │       ├── next.test.ts      [NEW]
│   │   │       ├── complete.ts       [NEW]
│   │   │       └── complete.test.ts  [NEW]
│   │   └── auth/, jobs/              (Unit 1)
│   └── auth/                         (Unit 1)
└── package.json                      [MODIFIED]
```
