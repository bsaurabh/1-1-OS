# Application Design Plan — 1:1OS

## Context
- **Project**: 1:1OS — AI Coaching Copilot for Design Managers
- **Stack**: Next.js 14+ (TypeScript) · Claude API · Supabase · Prisma · Vercel · Tailwind CSS
- **Features**: 8 epics, 17 user stories, 5 proposed units

---

## Part 1: Clarifying Questions

Three design decisions require your input before components and services can be finalized.

---

### Question 1
When a manager submits a meeting (paste / upload / voice), how should the AI analysis run?
(AI extracts themes, tags, tone, and commitments from the meeting content)

A) **Synchronous** — Manager waits on the same screen while AI processes (up to ~8s). Results appear immediately. Simpler architecture.
B) **Asynchronous** — Meeting is saved instantly, analysis runs in the background. Manager sees a "Processing..." indicator and results appear when ready (~8–15s later). Better UX for slow connections.
C) Other (please describe after [Answer]: tag below)

[Answer]:B. Allow mangers to navigate away form the page. Notoify them when ready. Browser notification and email notification.

---

### Question 2
Which Next.js architecture style should be used?

A) **App Router with Server Components** — Next.js 14+ App Router. Data fetching happens on the server; client components handle interactivity. Modern, but more complex mental model.
B) **Pages Router with API Routes** — Traditional Next.js pattern. All pages are client-rendered; data fetched via `/api/*` routes. Simpler, more familiar.
C) Other (please describe after [Answer]: tag below)

[Answer]:B

---

### Question 3
How should Claude API calls be structured across the application?

A) **Single unified AIService** — One service class handles all Claude calls (interview, meeting analysis, pattern detection, brief generation, coaching strategy). Central prompt library with per-feature prompt templates.
B) **Feature-specific AI handlers** — Each feature area (Profile, Meeting, Intelligence, Brief) has its own Claude integration directly. No shared abstraction.
C) Other (please describe after [Answer]: tag below)

[Answer]:B

---

## Part 2: Generation Execution Plan

*Executes after answers are received and approved.*

### Step 1: Define Components
- [x] Generate `aidlc-docs/inception/application-design/components.md`
  - [x] AuthComponent
  - [x] TeammateComponent
  - [x] InterviewAIHandler
  - [x] MeetingIngestionComponent
  - [x] TranscriptionComponent
  - [x] MeetingAnalysisHandler
  - [x] PatternDetectionHandler
  - [x] BriefGenerationHandler
  - [x] CoachingStrategyHandler
  - [x] CommitmentTracker
  - [x] GrowthTimeline
  - [x] NotificationComponent
  - [x] AnalysisJobQueue

### Step 2: Define Component Methods
- [x] Generate `aidlc-docs/inception/application-design/component-methods.md`
  - [x] Method signatures for all components
  - [x] Input / output types per method
  - [x] High-level purpose per method

### Step 3: Define Services
- [x] Generate `aidlc-docs/inception/application-design/services.md`
  - [x] Feature-specific AI handlers (per Q3: B)
  - [x] TranscriptionService
  - [x] StorageService
  - [x] AuthService
  - [x] DatabaseService (Prisma wrapper)
  - [x] EmailService
  - [x] PushNotificationService
  - [x] AnalysisQueueService

### Step 4: Define Component Dependencies
- [x] Generate `aidlc-docs/inception/application-design/component-dependency.md`
  - [x] Dependency matrix
  - [x] Data flow diagrams (6 flows)
  - [x] External service integration points

### Step 5: Validate
- [x] All 17 user stories traceable to at least one component
- [x] All external services (Claude, Whisper, Supabase, Resend, WebPush) mapped
- [x] No circular dependencies confirmed

---

*Awaiting answers to Part 1 questions before executing Part 2.*
