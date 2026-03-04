# Services — 1:1OS

**Date**: 2026-03-01
**Note**: Services wrap external systems and infrastructure. Application components call services — services never call components.

---

## Service Definitions

### 1. AuthService

**Purpose**: Wraps Supabase Auth for all authentication operations.

**External System**: Supabase Auth (JWT-based sessions)

**Methods**:
- `signUp(email, password)` → `{ user, session } | AuthError`
- `signIn(email, password)` → `{ user, session } | AuthError`
- `signOut(sessionToken)` → `void | AuthError`
- `requestPasswordReset(email)` → `void` (always succeeds — no email enumeration)
- `resetPassword(token, newPassword)` → `void | AuthError`
- `validateSession(sessionToken)` → `{ managerId, email } | null`

**Called by**: AuthComponent

---

### 2. DatabaseService

**Purpose**: Prisma ORM wrapper. Enforces manager-scoped queries — all write and read operations include `managerId` as a required parameter to prevent cross-user data access.

**External System**: Supabase PostgreSQL via Prisma

**Key Query Groups**:

*Teammates*
- `createTeammate(managerId, data)` → `Teammate`
- `getTeammate(managerId, teammateId)` → `Teammate | null`
- `listTeammates(managerId)` → `Teammate[]`
- `updateTeammate(managerId, teammateId, data)` → `Teammate`
- `deleteTeammate(managerId, teammateId)` → `void`

*Meetings*
- `createMeeting(managerId, teammateId, rawText, source)` → `Meeting`
- `updateMeetingAnalysis(meetingId, themes, tags, tone, summary)` → `Meeting`
- `listMeetings(managerId, teammateId, filter?)` → `Meeting[]`
- `getMeeting(managerId, meetingId)` → `Meeting | null`

*Patterns*
- `upsertPatterns(teammateId, patterns[])` → `void`
- `getPatterns(managerId, teammateId)` → `Pattern[]`

*Commitments*
- `createCommitment(managerId, teammateId, data)` → `Commitment`
- `updateCommitment(managerId, commitmentId, data)` → `Commitment`
- `listCommitments(managerId, teammateId, status?)` → `Commitment[]`
- `deleteCommitment(managerId, commitmentId)` → `void`

*Analysis Jobs*
- `enqueueJob(meetingId)` → `AnalysisJob`
- `getNextPendingJob()` → `AnalysisJob | null`
- `markJobComplete(jobId)` → `void`
- `markJobFailed(jobId, error)` → `void`

**Called by**: All application components

---

### 3. StorageService

**Purpose**: Wraps Supabase Storage for file uploads (transcripts, audio).

**External System**: Supabase Storage

**Methods**:
- `getUploadUrl(bucket, path)` → `{ uploadUrl, fileId }` — presigned URL for direct client upload
- `getText(bucket, fileId)` → `string` — extract text from stored .txt file
- `deleteFile(bucket, fileId)` → `void`
- `getPublicUrl(bucket, fileId)` → `string` — temporary URL for transcription API

**Storage Buckets**:
- `transcripts` — uploaded .txt / .docx / .pdf files (kept until processed, then deleted)
- `audio` — voice recording blobs (deleted immediately after transcription)

**Called by**: MeetingIngestionComponent, TranscriptionComponent

---

### 4. TranscriptionService

**Purpose**: Wraps the external transcription API (Whisper via OpenAI or Deepgram).

**External System**: Whisper API (OpenAI) — fallback: Deepgram

**Methods**:
- `transcribeFromUrl(audioUrl)` → `{ text: string, durationSeconds: number } | TranscriptionError`
  - Accepts a temporary public URL to an audio file
  - Returns full transcription text
  - Timeout: 90 seconds (for recordings up to 60 minutes)
- `isAvailable()` → `boolean` — health check before attempting transcription

**Error Handling**: On failure, returns `TranscriptionError` with message. Caller (TranscriptionComponent) surfaces "Transcription failed — please paste notes manually."

**Called by**: TranscriptionComponent

---

### 5. EmailService

**Purpose**: Sends transactional email notifications to managers.

**External System**: Resend (or SendGrid as fallback)

**Methods**:
- `sendAnalysisCompleteEmail(to, { teammateName, meetingDate, deepLinkUrl })` → `void | EmailError`
- `sendPasswordResetEmail(to, { resetUrl, expiresInMinutes })` → `void | EmailError`

**Templates**:
- `analysis-complete` — "Your 1:1 with [Teammate] has been analyzed. See insights →"
- `password-reset` — "Reset your 1:1OS password (expires in 60 minutes)"

**Called by**: NotificationComponent, AuthComponent

---

### 6. PushNotificationService

**Purpose**: Manages Web Push API subscriptions and sends browser push notifications.

**External System**: Web Push API (via `web-push` Node.js library on Vercel serverless)

**Methods**:
- `saveSubscription(managerId, subscription)` → `void` — persist Web Push subscription object
- `removeSubscription(managerId)` → `void`
- `sendNotification(managerId, { title, body, url })` → `void | PushError`
  - Fetches stored subscription for manager
  - Sends push payload
  - On error (subscription expired): removes subscription silently

**Called by**: NotificationComponent

---

### 7. AnalysisQueueService

**Purpose**: Abstracts job queue operations over the `analysis_jobs` Supabase table.

**External System**: Supabase PostgreSQL (`analysis_jobs` table)

**Methods**:
- `enqueue(meetingId)` → `AnalysisJob` — insert job with status `pending`
- `claimNext()` → `AnalysisJob | null` — atomic SELECT + UPDATE to claim one pending job (prevents double processing)
- `complete(jobId)` → `void` — set status `complete`
- `fail(jobId, errorMessage)` → `void` — set status `failed`, store error

**Polling**: Vercel cron (`/api/jobs/process-analysis`, every 30 seconds) calls `claimNext()` and processes one job per invocation.

**Called by**: MeetingIngestionComponent (enqueue), AnalysisJobQueue component (claim/complete/fail)
