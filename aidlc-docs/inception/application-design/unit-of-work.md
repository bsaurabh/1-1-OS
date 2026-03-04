# Units of Work — 1:1OS

**Date**: 2026-03-01
**Architecture**: Single Next.js app (Pages Router) — units are logical development groupings, not independently deployed services
**Build Sequence**: Strictly sequential — Unit 1 → 2 → 3 → 4 → 5

---

## Code Organization Strategy

**Folder structure**: Type-based (organized by what the code is, not which feature it belongs to)

```
/                                   # Repository root
├── pages/                          # Next.js pages + API routes
│   ├── _app.tsx                    # App wrapper, session provider
│   ├── index.tsx                   # Dashboard (teammate list)
│   ├── auth/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── teammates/
│   │   └── [id]/
│   │       ├── index.tsx           # Teammate overview / patterns
│   │       ├── brief.tsx           # Pre-meeting brief
│   │       ├── timeline.tsx        # Growth timeline
│   │       └── commitments.tsx     # Commitment tracker
│   └── api/
│       ├── auth/                   # register, login, logout, forgot, reset
│       ├── teammates/              # CRUD
│       ├── interviews/             # next-question, complete
│       ├── meetings/               # paste, upload, save-transcription
│       ├── transcription/          # start, transcribe, delete
│       ├── brief/                  # generate
│       ├── commitments/            # CRUD + status
│       ├── timeline/               # list, summary
│       ├── notifications/          # subscribe, unsubscribe
│       └── jobs/                   # process-analysis (Vercel cron)
│
├── components/                     # React UI components
│   ├── auth/                       # LoginForm, RegisterForm, ResetForm
│   ├── teammates/                  # TeammateCard, TeammateList, ProfileView
│   ├── interview/                  # InterviewChat, ProfileSummary
│   ├── meetings/                   # MeetingForm, PasteInput, FileUpload, VoiceRecorder
│   ├── brief/                      # BriefView, CoachingCard, QuestionList
│   ├── commitments/                # CommitmentList, CommitmentCard, SuggestedCommitments
│   ├── timeline/                   # TimelineList, MeetingEntry, TagFilter
│   └── shared/                     # Layout, Navbar, LoadingSpinner, Toast
│
├── lib/                            # Pure business logic (no React, no HTTP)
│   ├── auth/                       # session validation, password utils
│   ├── db/                         # Prisma client singleton
│   └── utils/                      # date formatting, text parsing, tag utils
│
├── services/                       # External system wrappers
│   ├── authService.ts
│   ├── databaseService.ts
│   ├── storageService.ts
│   ├── transcriptionService.ts
│   ├── emailService.ts
│   ├── pushNotificationService.ts
│   └── analysisQueueService.ts
│
├── handlers/                       # Feature-specific AI handlers (Claude API)
│   ├── interviewAIHandler.ts
│   ├── meetingAnalysisHandler.ts
│   ├── patternDetectionHandler.ts
│   ├── briefGenerationHandler.ts
│   └── coachingStrategyHandler.ts
│
├── prisma/
│   └── schema.prisma               # Full DB schema (defined in Unit 1)
│
└── public/                         # Static assets
```

---

## Unit Definitions

---

### Unit 1: Foundation

**Purpose**: Establish the entire project infrastructure, database schema, and authentication system. All subsequent units depend on this unit being complete.

**Scope**:
- Next.js project initialization (Pages Router, TypeScript, Tailwind CSS, ESLint)
- Supabase project setup (PostgreSQL, Auth, Storage buckets)
- Prisma schema — full schema for ALL entities (Manager, Teammate, Profile, Meeting, Pattern, Commitment, AnalysisJob, PushSubscription)
- AuthComponent implementation (register, login, logout, forgot/reset password)
- Session middleware — `withAuth` HOC for protected API routes and pages
- Vercel cron job configuration for `processNext` (every 30s) — scaffolded, not yet wired
- Base layout and navigation shell

**Components & Services**:
- AuthComponent, AuthService, DatabaseService, EmailService (reset only), AnalysisQueueService (scaffold)

**API Routes**:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/jobs/process-analysis` (Vercel cron — scaffolded)

**Entry Criteria**: None — this is the first unit
**Exit Criteria**:
- All auth flows working end-to-end (register → login → session → logout → forgot/reset)
- Full Prisma schema migrated to Supabase
- Protected routes reject unauthenticated requests
- Unit tests passing for AuthComponent and session middleware
- Vercel cron endpoint responding 200

---

### Unit 2: Teammate Profiles

**Purpose**: Enable manager to create direct report profiles via AI-led onboarding interview and manually edit them.

**Scope**:
- TeammateComponent (create, read, list, update, delete)
- InterviewAIHandler (conversational onboarding, profile synthesis via Claude)
- Profile display page with all fields
- Manual profile edit UI

**Components & Services**:
- TeammateComponent, InterviewAIHandler, DatabaseService, AuthService (session validation)

**API Routes**:
- `GET /api/teammates`
- `POST /api/teammates`
- `GET /api/teammates/[id]`
- `PATCH /api/teammates/[id]`
- `DELETE /api/teammates/[id]`
- `POST /api/interviews/[teammateId]/next`
- `POST /api/interviews/[teammateId]/complete`

**Entry Criteria**: Unit 1 complete (DB schema, auth middleware, DatabaseService)
**Exit Criteria**:
- Manager can add a teammate and complete the AI interview
- Profile fields populated and displayed correctly
- Manual edits persist
- Claude API fallback (manual form) tested
- Unit tests passing for TeammateComponent and InterviewAIHandler

---

### Unit 3: Meeting Ingestion

**Purpose**: Enable all three meeting input methods, run AI analysis asynchronously, extract commitments, and notify manager on completion.

**Scope**:
- MeetingIngestionComponent (paste, file upload, transcription ingest)
- TranscriptionComponent (voice recording, Whisper API, audio lifecycle)
- MeetingAnalysisHandler (async: themes, tags, tone, commitment extraction via Claude)
- AnalysisJobQueue (Vercel cron processor, wired to MeetingAnalysisHandler)
- NotificationComponent (browser push + email on analysis complete)
- CommitmentTracker — suggested commitment review (confirm / dismiss / edit)

**Components & Services**:
- MeetingIngestionComponent, TranscriptionComponent, MeetingAnalysisHandler, AnalysisJobQueue, CommitmentTracker (suggested only), NotificationComponent, StorageService, TranscriptionService, EmailService, PushNotificationService, AnalysisQueueService

**API Routes**:
- `POST /api/meetings/[teammateId]/paste`
- `POST /api/meetings/[teammateId]/upload`
- `POST /api/meetings/[teammateId]/save-transcription`
- `POST /api/transcription/start`
- `POST /api/transcription/transcribe`
- `DELETE /api/transcription/[fileId]`
- `GET /api/commitments/[teammateId]` (suggested status only)
- `PATCH /api/commitments/[id]` (confirm / dismiss)
- `POST /api/notifications/subscribe`
- `DELETE /api/notifications/subscribe`
- `GET /api/jobs/process-analysis` (fully wired to MeetingAnalysisHandler)

**Entry Criteria**: Unit 2 complete (teammate profiles exist, Claude integration proven)
**Exit Criteria**:
- All 3 ingestion methods working end-to-end
- Async analysis runs within 30s of ingestion (Vercel cron)
- Commitment suggestions appear after analysis and can be confirmed/dismissed
- Browser push + email notifications delivered on analysis complete
- Audio files deleted after transcription
- Unit tests + integration test (paste → analyze → commitments appear) passing

---

### Unit 4: Intelligence Engine

**Purpose**: Surface pattern intelligence from meeting history and generate the Pre-Meeting Brief with coaching strategy.

**Scope**:
- PatternDetectionHandler (full history analysis, severity classification, chained from Unit 3)
- BriefGenerationHandler (on-demand brief assembly via Claude)
- CoachingStrategyHandler (framework selection, called by BriefGenerationHandler)
- Pattern display on teammate page
- Pre-Meeting Brief page with regenerate and copy actions

**Components & Services**:
- PatternDetectionHandler, BriefGenerationHandler, CoachingStrategyHandler, DatabaseService

**API Routes**:
- `GET /api/teammates/[id]` — now includes patterns in response
- `POST /api/brief/[teammateId]/generate`

**Entry Criteria**: Unit 3 complete (meeting analysis produces themes/tags; patterns triggered by MeetingAnalysisHandler)
**Exit Criteria**:
- Patterns detected and displayed after 2+ meetings ingested
- Pre-Meeting Brief generates within 10s with all required sections
- Coaching framework + rationale present in every brief
- Claude fallback briefs tested
- Unit tests passing for all 3 handlers

---

### Unit 5: Tracker & Timeline

**Purpose**: Provide the full commitment lifecycle management and the growth timeline view.

**Scope**:
- CommitmentTracker — full status lifecycle (open → done / carried_forward / dropped), manual creation, broken pattern detection
- GrowthTimeline — tagged meeting list, tag filtering, on-demand AI growth summary
- Commitment tracker page
- Growth timeline page

**Components & Services**:
- CommitmentTracker (full), GrowthTimeline, DatabaseService

**API Routes**:
- `POST /api/commitments/[teammateId]` (manual create)
- `PATCH /api/commitments/[id]` (status update: done / carried_forward / dropped)
- `DELETE /api/commitments/[id]`
- `GET /api/timeline/[teammateId]`
- `POST /api/timeline/[teammateId]/summary`

**Entry Criteria**: Unit 4 complete (patterns + briefs surface open commitments; meetings have tags for timeline)
**Exit Criteria**:
- Commitments can be manually created and status-updated
- Broken commitment pattern (2+ carried forward) flagged in patterns and brief
- Timeline displays all meetings in reverse-chronological order with tags
- Tag filtering works
- AI growth summary generates on demand
- Unit tests passing for CommitmentTracker and GrowthTimeline
