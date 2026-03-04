# Domain Entities — Unit 4: Intelligence Engine

**Date**: 2026-03-02
**Unit**: Unit 4: Intelligence Engine

---

## Existing Entities Used (Read-Only Access)

### Meeting (from Unit 3)

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| managerId | String | Owner manager |
| teammateId | String | Related teammate |
| rawText | String | Original text |
| source | MeetingSource | PASTE / UPLOAD / VOICE |
| status | AnalysisStatus | PENDING_ANALYSIS / ANALYSIS_COMPLETE / ANALYSIS_FAILED |
| themes | Json | Array of theme strings |
| tags | String[] | Filtered tag list |
| summary | String? | 2–3 sentence summary |
| tone | String? | Meeting tone |
| createdAt | DateTime | Ingestion timestamp |

**Unit 4 access**: Read-only. Used by PatternDetectionHandler (full history) and BriefGenerationHandler (last meeting + all meetings).

### Teammate (from Unit 2)

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| managerId | String | Owner manager |
| name | String | Teammate name |
| role | String | Job role |
| profile | Json? | AI-generated profile fields |

**Unit 4 access**: Read-only. Profile used as context for brief generation and coaching strategy selection.

### Commitment (from Unit 3)

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| managerId | String | Owner |
| teammateId | String | Related teammate |
| meetingId | String? | Source meeting (if AI-extracted) |
| text | String | Commitment text |
| owner | CommitmentOwner | MANAGER / TEAMMATE |
| status | CommitmentStatus | SUGGESTED / OPEN / DONE / CARRIED_FORWARD / DROPPED |
| carryCount | Int | Times carried forward |

**Unit 4 access**: Read-only. OPEN + CARRIED_FORWARD commitments surfaced in brief (US-10).

---

## Existing Entities Modified

### Pattern (from Unit 1 schema — first real implementation in Unit 4)

The `Pattern` model was defined in the Unit 1 schema but never populated. Unit 4 is the first unit to write to it.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| teammateId | String | Related teammate |
| description | String | Human-readable pattern description |
| severity | PatternSeverity | INFORMATIONAL / WATCH / ACTION_REQUIRED |
| evidence | Json | `{ meetingIds: string[], dates: string[], tags: string[] }` |
| detectedAt | DateTime | When first detected / last updated |

**Unit 4 writes**: PatternDetectionHandler upserts Pattern rows after each meeting analysis.

**Evidence JSON shape**:
```json
{
  "meetingIds": ["mtg-1", "mtg-2", "mtg-3"],
  "dates": ["2026-02-01", "2026-02-08", "2026-02-15"],
  "tags": ["blocker", "workload"]
}
```

---

## Value Objects (No DB Storage)

### Brief (runtime only — never persisted)

```typescript
interface Brief {
  teammateId: string
  generatedAt: string      // ISO timestamp
  contextSummary: string   // last meeting recap + open threads
  openCommitments: BriefCommitment[]
  patterns: BriefPattern[]
  coachingFocus: string    // 1-2 sentence suggested focus
  riskSignals: string[]    // ACTION_REQUIRED pattern descriptions
  followUpQuestions: string[]   // 5-7 questions
  uncomfortableQuestion: string // 1 bold question
  coachingApproach: CoachingApproach
}

interface BriefCommitment {
  text: string
  owner: 'MANAGER' | 'TEAMMATE'
  status: 'OPEN' | 'CARRIED_FORWARD'
  carryCount: number
}

interface BriefPattern {
  description: string
  severity: 'INFORMATIONAL' | 'WATCH' | 'ACTION_REQUIRED'
  meetingCount: number
}

interface CoachingApproach {
  framework: string        // e.g., "GROW"
  rationale: string        // 2-3 sentences
  actions: string[]        // 1-2 suggested coaching actions
}
```

### BriefFallback (runtime only — returned when Claude fails)

```typescript
interface BriefFallback {
  commitments: BriefCommitment[]
  lastMeetingSummary: string | null
  lastMeetingDate: string | null
}
```

### DetectedPattern (intermediate object — PatternDetectionHandler output)

```typescript
interface DetectedPattern {
  description: string
  severity: 'INFORMATIONAL' | 'WATCH' | 'ACTION_REQUIRED'
  evidence: {
    meetingIds: string[]
    dates: string[]
    tags: string[]
  }
}
```

---

## Entity Relationships Relevant to Unit 4

```
Teammate ──< Meeting          (one teammate has many meetings)
Teammate ──< Pattern          (one teammate has many patterns)
Teammate ──< Commitment       (one teammate has many commitments)

Meeting data → PatternDetectionHandler → upserts Pattern rows
Teammate profile + Meeting history + Pattern list + Commitments
  → BriefGenerationHandler → Brief (runtime, not stored)
  → CoachingStrategyHandler → CoachingApproach (part of Brief)
```

---

## Coaching Frameworks Catalog (Value Object)

| ID | Name | Best For |
|----|------|----------|
| GROW | Goals, Reality, Options, Will | Goal-setting conversations |
| SBI | Situation, Behavior, Impact | Feedback delivery |
| STRENGTHS | Strengths-Based Coaching | Motivation and energy conversations |
| OSCAR | Outcome, Situation, Choices, Actions, Review | Structured problem-solving |
| SOCRATIC | Socratic Questioning | Building self-awareness |
| MOTIVATIONAL | Motivational Interviewing | Ambivalence and behavior change |
