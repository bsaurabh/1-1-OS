# Domain Entities — Unit 2: Teammate Profiles

**Date**: 2026-03-01
**Unit**: Unit 2: Teammate Profiles
**Stories**: US-03, US-04

---

## Entity Overview

```
Manager (Unit 1)
  |
  |-- owns --> Teammate (1 per direct report)
                 |
                 +--> profile: ProfileFields (JSONB, nullable)
                 |
                 +--> [Interview conducted client-side, result written to profile]
```

---

## 1. Teammate

**Storage**: `teammates` table (Prisma model, defined in Unit 1)
**Scope**: One record per direct report per manager.

```typescript
interface Teammate {
  id: string           // cuid() primary key
  managerId: string    // FK to managers.id (owner)
  name: string         // Full name of the direct report
  role: string         // Job title or role (e.g. "Senior Product Designer")
  profile: ProfileFields | null  // JSONB — null until interview or manual entry
  createdAt: Date
  updatedAt: Date
}
```

**Notes**:
- `role` is stored as a top-level column (not inside the JSONB) because it is always required and is used by later units (Meeting Analysis, Brief Generation) as a core context field.
- `profile` starts as `null` after creation. The interview or manual edit populates it.

---

## 2. ProfileFields

**Storage**: Stored as JSONB in `Teammate.profile`.
**Scope**: The 7 interviewable profile areas (role is stored separately as a top-level column).

```typescript
interface ProfileFields {
  strengths?: string           // Key strengths the manager observes
  growthAreas?: string         // Areas needing development
  aspirations?: string         // Career goals and ambitions
  kpis?: string                // KPIs or success metrics the teammate owns
  behavioralTendencies?: string // How they behave in team settings
  feedbackStyle?: string       // How they prefer to receive feedback
  motivationDrivers?: string   // What motivates their best work
}
```

**Completeness**: A field is "populated" if it is a non-empty string. `null`, `undefined`, and `""` all count as unpopulated.

**Total countable fields**: 8 (role + 7 JSONB fields). `role` always counts as populated since it is required at creation.

---

## 3. ProfileArea (Enum)

Defines the 7 interviewable areas in the fixed interview order.

```typescript
enum ProfileArea {
  STRENGTHS             = 'strengths',
  GROWTH_AREAS          = 'growthAreas',
  ASPIRATIONS           = 'aspirations',
  KPIS                  = 'kpis',
  BEHAVIORAL_TENDENCIES = 'behavioralTendencies',
  FEEDBACK_STYLE        = 'feedbackStyle',
  MOTIVATION_DRIVERS    = 'motivationDrivers',
}
```

**Interview order** (fixed, index 1–7):

| Index | Area                 | ProfileFields key      |
|-------|----------------------|------------------------|
| 1     | Strengths            | `strengths`            |
| 2     | Growth Areas         | `growthAreas`          |
| 3     | Aspirations          | `aspirations`          |
| 4     | KPIs                 | `kpis`                 |
| 5     | Behavioral Tendencies| `behavioralTendencies` |
| 6     | Feedback Style       | `feedbackStyle`        |
| 7     | Motivation Drivers   | `motivationDrivers`    |

---

## 4. ConversationTurn

**Storage**: Client-side only (held in React state). Not persisted to the database during the interview.

```typescript
interface ConversationTurn {
  questionIndex: number   // 1–7, corresponds to the fixed area order
  area: ProfileArea       // Which profile area this turn covers
  question: string        // The exact question text Claude generated
  answer: string          // The manager's free-text answer
}
```

---

## 5. InterviewSessionState

**Storage**: React component state / in-memory on the client. Sent to the server with every API call; server is stateless.

```typescript
interface InterviewSessionState {
  teammateId: string
  teammateName: string
  role: string
  turns: ConversationTurn[]     // Accumulates completed Q&A pairs (answer filled in)
  currentQuestionIndex: number  // 1–7; 8 means interview complete
  currentQuestion: string       // Question text for the current turn (Claude's output)
  currentArea: ProfileArea      // Area for the current turn
  isComplete: boolean           // true after all 7 answers submitted
  isFallback: boolean           // true if Claude API failed at any point
}
```

**Lifecycle**:
1. Initialized with empty `turns`, `currentQuestionIndex = 0`, `isComplete = false` after teammate creation.
2. First `POST /api/interviews/[id]/next` call (with `conversationHistory: []`) returns question 1 and sets `currentQuestionIndex = 1`.
3. Each subsequent call appends the answered turn to `turns` and returns the next question.
4. After question 7 is answered, server returns `{ isComplete: true }`.
5. Frontend calls `POST /api/interviews/[id]/complete` with all 7 turns.
6. Server returns synthesized `ProfileFields`, which is persisted to `Teammate.profile`.

---

## 6. API Request / Response Shapes

### POST /api/teammates
```typescript
interface CreateTeammateRequest {
  name: string   // Required
  role: string   // Required
}

interface CreateTeammateResponse {
  id: string
  name: string
  role: string
  createdAt: string
}
```

### GET /api/teammates
```typescript
interface TeammateListResponse {
  teammates: TeammateListItem[]
}

interface TeammateListItem {
  id: string
  name: string
  role: string
  profileCompleteness: number  // 0–8 (count of populated fields including role)
  createdAt: string
}
```

### GET /api/teammates/[id]
```typescript
interface TeammateDetailResponse {
  id: string
  managerId: string
  name: string
  role: string
  profile: ProfileFields | null
  profileCompleteness: number  // 0–8
  createdAt: string
  updatedAt: string
}
```

### PATCH /api/teammates/[id]
```typescript
interface UpdateTeammateRequest {
  name?: string
  role?: string
  profile?: Partial<ProfileFields>  // Only the changed fields
}

interface UpdateTeammateResponse {
  id: string
  name: string
  role: string
  profile: ProfileFields | null
  profileCompleteness: number
  updatedAt: string
}
```

### DELETE /api/teammates/[id]
Returns `204 No Content` on success. Cascade deletes all related records.

### POST /api/interviews/[teammateId]/next
```typescript
interface NextQuestionRequest {
  conversationHistory: ConversationTurn[]  // All completed turns so far (may be empty for first call)
  latestAnswer?: string                    // Omitted on the very first call
}

interface NextQuestionResponse {
  question: string        // Next question text from Claude Haiku
  questionIndex: number   // 1–7
  area: ProfileArea
  isComplete: boolean     // true if all 7 questions have been answered (after answer 7)
}
```

### POST /api/interviews/[teammateId]/complete
```typescript
interface CompleteInterviewRequest {
  conversationHistory: ConversationTurn[]  // All 7 turns with answers
}

interface CompleteInterviewResponse {
  profile: ProfileFields   // Synthesized profile from Claude Sonnet
}
```

---

## Entity Relationship Summary

```
Manager (Unit 1)
  id ─────────────────────────────────────────┐
                                              |
Teammate                                      |
  id (cuid)                                   |
  managerId ──────────────────────────────────┘ FK
  name (string, required)
  role (string, required)
  profile (JSONB, nullable)
    └── ProfileFields
          strengths?
          growthAreas?
          aspirations?
          kpis?
          behavioralTendencies?
          feedbackStyle?
          motivationDrivers?
  createdAt, updatedAt

[Client-side only — not in DB]
InterviewSessionState
  turns: ConversationTurn[]
    - questionIndex (1-7)
    - area (ProfileArea)
    - question (Claude-generated)
    - answer (manager-provided)
```

---

## Data Flow: Interview → Profile

```
Manager fills AddTeammateModal (name + role)
  --> POST /api/teammates --> Teammate record created (profile: null)
  --> Frontend initializes InterviewSessionState
  --> POST /api/interviews/[id]/next (empty history)
    --> Claude Haiku generates Q1 (strengths)
  --> Manager answers Q1
  --> POST /api/interviews/[id]/next (history: [Q1+A1])
    --> Claude Haiku generates Q2 (growthAreas)
  ... repeats for Q2-Q6 ...
  --> Manager answers Q7
  --> POST /api/interviews/[id]/next (history: [Q1-Q7 + A1-A7])
    --> Returns { isComplete: true }
  --> Frontend calls POST /api/interviews/[id]/complete (history: all 7 turns)
    --> Claude Sonnet synthesizes ProfileFields
    --> Server PATCHes Teammate.profile
  --> Frontend redirects to /teammates/[id] (ProfileView)
```
