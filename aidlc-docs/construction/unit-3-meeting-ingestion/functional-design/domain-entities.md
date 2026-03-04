# Domain Entities — Unit 3: Meeting Ingestion

**Date**: 2026-03-02
**Unit**: Unit 3: Meeting Ingestion

---

## Core Entities

---

### Meeting

Represents a single 1:1 session captured via any of the three input methods.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` (cuid) | Primary key |
| `managerId` | `string` | Owner — used for authorization |
| `teammateId` | `string` | FK to Teammate; cascade delete |
| `rawText` | `string` | The complete text content (pasted, extracted from file, or transcribed) |
| `source` | `MeetingSource` | `PASTE \| UPLOAD \| VOICE` |
| `status` | `AnalysisStatus` | `PENDING_ANALYSIS \| ANALYSIS_COMPLETE \| ANALYSIS_FAILED` |
| `themes` | `Theme[] \| null` (JSON) | AI-extracted discussion themes |
| `tags` | `string[]` | 1–3 category tags from fixed taxonomy |
| `summary` | `string \| null` | AI-generated one-line meeting summary |
| `tone` | `string \| null` | AI-assessed overall tone (e.g., "constructive", "tense") |
| `createdAt` | `DateTime` | Ingestion timestamp |
| `updatedAt` | `DateTime` | Last update (set on analysis complete) |

**Relations**: belongs to `Teammate`, has many `Commitment`, has one `AnalysisJob`

---

### AnalysisJob

Tracks the async analysis pipeline for a single meeting. One job per meeting.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` (cuid) | Primary key |
| `meetingId` | `string` | FK to Meeting (unique — one job per meeting) |
| `status` | `JobStatus` | `PENDING \| PROCESSING \| COMPLETE \| FAILED` |
| `retryCount` | `int` | Number of previous failed attempts (0–2) |
| `error` | `string \| null` | Last error message if failed |
| `createdAt` | `DateTime` | Job creation time |
| `processedAt` | `DateTime \| null` | Completion time |

> **Note**: `retryCount` is not in the Unit 1 schema. A DB migration adds this column in Unit 3 (`ALTER TABLE analysis_jobs ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0`).

**Retry lifecycle**:
- `status = FAILED, retryCount < 2` → eligible for re-processing on next cron tick
- `status = FAILED, retryCount = 2` → permanently failed; manager notified

---

### Commitment (SUGGESTED status subset — Unit 3)

Full lifecycle in Unit 5. Unit 3 handles: AI-extracted suggestions, confirm, dismiss.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` (cuid) | Primary key |
| `managerId` | `string` | For authorization |
| `teammateId` | `string` | FK to Teammate |
| `meetingId` | `string \| null` | FK to the source meeting |
| `text` | `string` | Commitment statement text |
| `owner` | `CommitmentOwner` | `MANAGER \| TEAMMATE` |
| `status` | `CommitmentStatus` | `SUGGESTED` (on creation) → `OPEN` (on confirm) or deleted (on dismiss) |
| `carryCount` | `int` | Default 0; incremented in Unit 5 |
| `dueDate` | `DateTime \| null` | Optional; null for AI-extracted suggestions |
| `createdAt` | `DateTime` | — |
| `updatedAt` | `DateTime` | — |

---

### PushSubscription

Stores a manager's Web Push subscription object for browser notifications.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` (cuid) | Primary key |
| `managerId` | `string` (unique) | One subscription per manager |
| `subscription` | `Json` | Full Web Push subscription object (endpoint, keys.auth, keys.p256dh) |
| `createdAt` | `DateTime` | — |

---

## Supporting Types (Not Persisted)

---

### Theme

Represents one AI-extracted discussion theme from a meeting. Stored in `Meeting.themes` (JSON array).

```typescript
interface Theme {
  title:       string   // e.g., "Delivery velocity concerns"
  description: string   // 1–2 sentence elaboration
}
```

---

### CategoryTag

One of the 8 fixed category tags used for timeline filtering.

```typescript
type CategoryTag =
  | 'growth'
  | 'delivery'
  | 'relationships'
  | 'wellbeing'
  | 'strategy'
  | 'feedback'
  | 'process'
  | 'recognition'
```

---

### CommitmentSuggestion

The shape of one commitment extracted by Claude during analysis. Stored transiently — persisted as `Commitment` records after extraction.

```typescript
interface CommitmentSuggestion {
  text:  string             // Exact or paraphrased commitment statement
  owner: 'MANAGER' | 'TEAMMATE'
}
```

---

### MeetingAnalysisResult

The structured response Claude returns from the single analysis call.

```typescript
interface MeetingAnalysisResult {
  themes:      Theme[]                // 2–5 key discussion themes
  tags:        CategoryTag[]          // 1–3 tags from fixed taxonomy
  tone:        string                 // Overall tone descriptor
  summary:     string                 // One-line summary sentence
  commitments: CommitmentSuggestion[] // May be empty []
}
```

---

### AudioUploadTicket

Transient object returned by `TranscriptionComponent.getAudioUploadUrl()`. Not persisted.

```typescript
interface AudioUploadTicket {
  uploadUrl: string   // Supabase Storage presigned PUT URL
  fileId:    string   // Unique identifier for the stored audio file
}
```

---

## Enumerations

### MeetingSource
```
PASTE   — Manager pasted notes directly
UPLOAD  — Manager uploaded a .txt / .docx / .pdf file
VOICE   — Manager recorded voice; text came from Whisper transcription
```

### AnalysisStatus (on Meeting)
```
PENDING_ANALYSIS  — Meeting saved; analysis job queued but not yet run
ANALYSIS_COMPLETE — Claude analysis finished; themes/tags/summary/tone/commitments populated
ANALYSIS_FAILED   — Analysis permanently failed after 2 retry attempts
```

### JobStatus (on AnalysisJob)
```
PENDING    — Waiting to be claimed by cron processor
PROCESSING — Currently being processed (claimed by cron)
COMPLETE   — Successfully analyzed
FAILED     — Error occurred; may be retried if retryCount < 2
```

### CommitmentOwner
```
MANAGER  — The 1:1 manager made this commitment
TEAMMATE — The direct report made this commitment
```

### CommitmentStatus (Unit 3 subset)
```
SUGGESTED — AI-extracted; awaiting manager review
OPEN      — Manager confirmed; active commitment (full lifecycle in Unit 5)
```

---

## Entity Relationship Summary

```
Manager ──< Teammate ──< Meeting ──< Commitment
                              |
                              └──< AnalysisJob

Manager ──1 PushSubscription
```

All cascade-delete from `Manager` → `Teammate` → `Meeting` is already configured in the Unit 1 schema.
