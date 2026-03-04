# Component Definitions — 1:1OS

**Architecture**: Next.js Pages Router · Feature-specific AI handlers · Async meeting analysis
**Date**: 2026-03-01

---

## Component Overview

```
+--------------------------------------------------+
|                  FRONTEND (Pages)                |
|  AuthPages | DashboardPage | TeammatePage        |
|  MeetingPage | BriefPage | TimelinePage          |
+--------------------------------------------------+
           |              |
     API Routes      Client-side
     /api/*          state/fetch
           |
+--------------------------------------------------+
|               APPLICATION COMPONENTS             |
+------------------+-------------------------------+
| Auth             | AuthComponent                 |
| Teammates        | TeammateComponent             |
| Profile AI       | InterviewAIHandler            |
| Meeting Ingest   | MeetingIngestionComponent     |
| Transcription    | TranscriptionComponent        |
| Meeting AI       | MeetingAnalysisHandler        |
| Patterns AI      | PatternDetectionHandler       |
| Brief AI         | BriefGenerationHandler        |
| Coaching AI      | CoachingStrategyHandler       |
| Commitments      | CommitmentTracker             |
| Timeline         | GrowthTimeline                |
| Notifications    | NotificationComponent         |
| Job Queue        | AnalysisJobQueue              |
+------------------+-------------------------------+
           |
+--------------------------------------------------+
|                    SERVICES                      |
|  AuthService | DatabaseService | StorageService  |
|  TranscriptionService | EmailService             |
|  PushNotificationService | AnalysisQueueService  |
+--------------------------------------------------+
           |
+--------------------------------------------------+
|               EXTERNAL SYSTEMS                   |
|  Supabase (DB + Auth + Storage)                  |
|  Claude API (Anthropic)                          |
|  Whisper API / Deepgram                          |
|  Email Provider (Resend)                         |
+--------------------------------------------------+
```

---

## Component Definitions

### 1. AuthComponent

**Purpose**: Handles all authentication flows for Design Manager accounts.

**Responsibilities**:
- Register new manager account (email + password)
- Authenticate manager (login)
- Terminate session (logout)
- Initiate and process forgot-password reset flow
- Validate active session on protected routes
- Enforce per-manager data isolation by embedding manager ID in all downstream calls

**Owned API Routes**:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

---

### 2. TeammateComponent

**Purpose**: Manages the lifecycle of direct report profiles for a manager.

**Responsibilities**:
- Create new teammate record (name, role)
- Retrieve a single teammate's full profile
- List all teammates for the authenticated manager
- Update teammate profile fields (manual edits post-interview)
- Delete a teammate and all associated data
- Enforce that all operations are scoped to the authenticated manager's ID

**Owned API Routes**:
- `POST /api/teammates`
- `GET /api/teammates`
- `GET /api/teammates/[id]`
- `PATCH /api/teammates/[id]`
- `DELETE /api/teammates/[id]`

---

### 3. InterviewAIHandler

**Purpose**: Drives the AI-led onboarding interview to build a structured teammate profile.

**Responsibilities**:
- Maintain the interview question sequence (role, strengths, growth areas, aspirations, KPIs, behavioral tendencies, feedback style, motivation drivers)
- Accept manager's free-text answers and generate the next contextual question
- Synthesize all interview answers into a structured profile object at interview completion
- Handle Claude API failures gracefully — surface fallback manual form

**AI Integration**: Direct Claude API call with interview-specific system prompt. No shared service.

**Owned API Routes**:
- `POST /api/interviews/[teammateId]/next` — get next question
- `POST /api/interviews/[teammateId]/complete` — finalize and generate profile

---

### 4. MeetingIngestionComponent

**Purpose**: Receives meeting content via all three input methods and persists it, then queues async analysis.

**Responsibilities**:
- Accept pasted text and validate minimum length (50 chars)
- Accept uploaded file (.txt, .docx, .pdf), validate type and size (max 10MB), extract text via parser
- Accept confirmed transcription text from TranscriptionComponent
- Save raw meeting record to database with status `pending_analysis`
- Enqueue an analysis job via AnalysisJobQueue
- Return immediately to caller — does not wait for analysis to complete

**Owned API Routes**:
- `POST /api/meetings/[teammateId]/paste`
- `POST /api/meetings/[teammateId]/upload`
- `POST /api/meetings/[teammateId]/save-transcription`

---

### 5. TranscriptionComponent

**Purpose**: Manages the full browser-side voice recording flow and server-side transcription.

**Responsibilities**:
- Signal browser to start/stop audio recording (coordinates with client-side MediaRecorder)
- Receive audio blob from client, upload to temporary Supabase Storage location
- Call TranscriptionService with the audio file URL
- Return transcribed text to the client for review/editing
- Delete audio file from storage after successful transcription or discard
- Handle transcription failure — return error, prompt manual input

**Owned API Routes**:
- `POST /api/transcription/start` — generate upload URL for audio
- `POST /api/transcription/transcribe` — trigger transcription from stored audio URL
- `DELETE /api/transcription/[fileId]` — delete audio file

---

### 6. MeetingAnalysisHandler

**Purpose**: AI analysis of a single meeting's content — runs asynchronously after ingestion.

**Responsibilities**:
- Receive meeting text from the job queue
- Extract themes, emotional tone, and category tags (Growth, Blocker, Motivation, Skill Gap, Conflict, Win, Accountability, Other)
- Detect commitment statements and attribute each to Manager or Teammate
- Persist extracted themes, tags, and suggested commitments back to the meeting record
- Update meeting status from `pending_analysis` to `analysis_complete`
- Trigger NotificationComponent on completion

**AI Integration**: Direct Claude API call with meeting-analysis-specific system prompt. Includes full teammate profile context.

**Triggered by**: AnalysisJobQueue (not a direct API route)

---

### 7. PatternDetectionHandler

**Purpose**: Detects behavioral and situational patterns across a teammate's full meeting history.

**Responsibilities**:
- Load all analyzed meetings for a teammate (full history)
- Identify repeated blockers, avoided topics, skill stagnation, emotional dips, motivation fluctuations, ownership changes, and broken commitment patterns
- Assign severity to each pattern: Informational / Watch / Action Required
- Persist detected patterns to the database, replacing previous pattern analysis for this teammate
- Triggered after each new meeting analysis completes

**AI Integration**: Direct Claude API call with pattern-detection-specific system prompt. Receives all meeting summaries and tags as structured input.

**Triggered by**: MeetingAnalysisHandler (chained after analysis completes)

---

### 8. BriefGenerationHandler

**Purpose**: Generates the Pre-Meeting Brief for a specific teammate on demand.

**Responsibilities**:
- Load teammate profile, last 3 meeting summaries, all open commitments, and all active patterns
- Generate a structured brief: context summary, open commitments, pattern signals, risk signals, coaching focus, 5–7 tailored questions, one uncomfortable question
- Include CoachingStrategyHandler output as the "Coaching Approach" section of the brief
- Return brief as structured JSON (not persisted — generated fresh on each request)
- Handle Claude API failures — return fallback brief containing raw open commitments and last meeting summary

**AI Integration**: Direct Claude API call with brief-generation-specific system prompt.

**Owned API Routes**:
- `POST /api/brief/[teammateId]/generate`

---

### 9. CoachingStrategyHandler

**Purpose**: Selects and explains the most relevant coaching framework for a teammate's current situation.

**Responsibilities**:
- Receive teammate profile + recent meeting themes + active patterns as input
- Select the most appropriate coaching framework from the supported set (Situational Leadership, Radical Candor, Growth Mindset, Deliberate Practice, Accountability Loop, Psychological Safety)
- Generate a 2–3 sentence explanation of why this framework fits this individual right now
- Generate 1–2 specific coaching actions suggested by the framework
- Return selection + rationale — consumed by BriefGenerationHandler
- Handle low-confidence fallback: return generic open-questioning suggestion

**AI Integration**: Direct Claude API call with coaching-strategy-specific system prompt. Called internally by BriefGenerationHandler, not independently.

---

### 10. CommitmentTracker

**Purpose**: Manages the full lifecycle of commitments — from AI extraction to manual logging to resolution.

**Responsibilities**:
- Receive suggested commitments from MeetingAnalysisHandler and persist as status `suggested`
- Allow manager to confirm a suggested commitment → status becomes `open`
- Allow manager to dismiss a suggested commitment → deleted
- Allow manager to edit commitment text before confirming
- Allow manager to manually create a commitment (type, owner: Manager or Teammate, optional due date)
- Allow manager to update commitment status: `open` → `done` | `carried_forward` | `dropped`
- Detect broken commitment pattern: any commitment carried forward 2+ consecutive times
- Provide open commitments list for a teammate (consumed by BriefGenerationHandler)

**Owned API Routes**:
- `GET /api/commitments/[teammateId]`
- `POST /api/commitments/[teammateId]` — manual create
- `PATCH /api/commitments/[id]` — confirm / dismiss / update status
- `DELETE /api/commitments/[id]`

---

### 11. GrowthTimeline

**Purpose**: Provides the chronological tagged meeting history view for a teammate.

**Responsibilities**:
- Return all analyzed meetings for a teammate in reverse-chronological order
- Each meeting entry includes: date, AI-generated one-line summary, category tags
- Support tag-based filtering
- On demand, generate an AI growth summary paragraph for the teammate (current state snapshot)

**AI Integration**: Direct Claude API call for on-demand growth summary only. Minimal prompt — receives meeting tag history as input.

**Owned API Routes**:
- `GET /api/timeline/[teammateId]` — paginated meeting list with optional tag filter
- `POST /api/timeline/[teammateId]/summary` — generate AI growth summary on demand

---

### 12. NotificationComponent

**Purpose**: Notifies the manager when async meeting analysis completes.

**Responsibilities**:
- Send browser push notification to the manager's active browser session (Web Push API)
- Send email notification to the manager's registered email address
- Notification content: teammate name, meeting date, CTA link to the teammate's page
- Handle push subscription management (subscribe / unsubscribe)

**Owned API Routes**:
- `POST /api/notifications/subscribe` — store push subscription
- `DELETE /api/notifications/subscribe` — unsubscribe

---

### 13. AnalysisJobQueue

**Purpose**: Manages the async queue for meeting analysis jobs.

**Responsibilities**:
- Enqueue a new analysis job when a meeting is ingested
- Poll or trigger job processing (Supabase-based queue table, processed by a Vercel serverless function on a schedule or via Supabase Edge Function)
- Invoke MeetingAnalysisHandler for the next pending job
- Mark job as complete or failed
- On failure: log error, update meeting status to `analysis_failed`, notify manager

**Implementation**: `analysis_jobs` table in Supabase. Vercel cron job (`/api/jobs/process-analysis`) polls for pending jobs every 30 seconds.

**Owned API Routes**:
- `POST /api/jobs/process-analysis` — Vercel cron endpoint (not user-facing)
