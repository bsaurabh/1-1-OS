# Component Dependencies — 1:1OS

**Date**: 2026-03-01

---

## Dependency Matrix

| Component                  | Depends On                                                              |
|----------------------------|-------------------------------------------------------------------------|
| AuthComponent              | AuthService, EmailService                                               |
| TeammateComponent          | DatabaseService                                                         |
| InterviewAIHandler         | DatabaseService *(Claude API direct)*                                   |
| MeetingIngestionComponent  | DatabaseService, StorageService, AnalysisQueueService                  |
| TranscriptionComponent     | StorageService, TranscriptionService                                    |
| MeetingAnalysisHandler     | DatabaseService *(Claude API direct)* → triggers PatternDetectionHandler, NotificationComponent |
| PatternDetectionHandler    | DatabaseService *(Claude API direct)*                                   |
| BriefGenerationHandler     | DatabaseService, CommitmentTracker, CoachingStrategyHandler *(Claude API direct)* |
| CoachingStrategyHandler    | *(Claude API direct)* — called by BriefGenerationHandler only           |
| CommitmentTracker          | DatabaseService                                                         |
| GrowthTimeline             | DatabaseService *(Claude API direct — growth summary only)*             |
| NotificationComponent      | PushNotificationService, EmailService                                   |
| AnalysisJobQueue           | AnalysisQueueService → invokes MeetingAnalysisHandler                  |

*Direct Claude API calls* = feature-specific handler makes its own API call, no shared service.

---

## Data Flow Diagrams

### Flow 1: Manager Registration and Login

```
Manager Browser
    |
    | POST /api/auth/register
    v
AuthComponent
    |-- AuthService.signUp(email, password)
    |       |-- Supabase Auth (creates user)
    |-- returns { managerId, token }
    |
    | [on forgot password]
    |-- AuthService.requestPasswordReset(email)
    |-- EmailService.sendPasswordResetEmail(email, resetUrl)
```

---

### Flow 2: Teammate Onboarding Interview

```
Manager Browser
    |
    | POST /api/interviews/[teammateId]/next  (repeat)
    v
InterviewAIHandler
    |-- Claude API (interview prompt + teammate name/role + prior answers)
    |-- returns next question
    |
    | POST /api/interviews/[teammateId]/complete
    v
InterviewAIHandler.generateProfile()
    |-- Claude API (synthesize all answers → structured profile)
    |
TeammateComponent.update(managerId, teammateId, profileFields)
    |-- DatabaseService.updateTeammate(...)
```

---

### Flow 3: Meeting Ingestion (Async Path)

```
Manager Browser
    |
    | POST /api/meetings/[teammateId]/paste  (or /upload or /save-transcription)
    v
MeetingIngestionComponent
    |-- DatabaseService.createMeeting(...)   [status: pending_analysis]
    |-- AnalysisQueueService.enqueue(meetingId)
    |-- returns { meetingId } immediately
    |
    | [browser shows "Analyzing..." indicator]
    |
    | [Vercel cron: every 30s]
    v
AnalysisJobQueue.processNext()
    |-- AnalysisQueueService.claimNext()
    |-- MeetingAnalysisHandler.analyze(meetingId)
    |       |-- DatabaseService.getMeeting(meetingId)
    |       |-- DatabaseService.getTeammate(teammateId)   [for profile context]
    |       |-- Claude API (analysis prompt + meeting text + profile)
    |       |-- DatabaseService.updateMeetingAnalysis(meetingId, results)
    |       |-- CommitmentTracker.saveSuggested(meetingId, extractedCommitments)
    |       |-- PatternDetectionHandler.detectPatterns(teammateId)
    |       |       |-- DatabaseService.listMeetings(teammateId)   [full history]
    |       |       |-- Claude API (pattern prompt + all meeting summaries)
    |       |       |-- DatabaseService.upsertPatterns(teammateId, patterns)
    |       |-- NotificationComponent.notifyAnalysisComplete(managerId, ...)
    |               |-- PushNotificationService.sendNotification(managerId, ...)
    |               |-- EmailService.sendAnalysisCompleteEmail(email, ...)
    |-- AnalysisQueueService.complete(jobId)
```

---

### Flow 4: Voice Recording

```
Manager Browser (MediaRecorder API)
    |
    | POST /api/transcription/start
    v
TranscriptionComponent.getAudioUploadUrl()
    |-- StorageService.getUploadUrl('audio', path)
    |-- returns { uploadUrl, fileId }
    |
    | [browser uploads audio blob directly to Supabase Storage]
    |
    | POST /api/transcription/transcribe
    v
TranscriptionComponent.transcribe(fileId)
    |-- StorageService.getPublicUrl('audio', fileId)
    |-- TranscriptionService.transcribeFromUrl(audioUrl)
    |       |-- Whisper API / Deepgram
    |-- StorageService.deleteFile('audio', fileId)   [audio deleted after transcription]
    |-- returns { text }
    |
    | [manager reviews + edits transcription in browser]
    |
    | POST /api/meetings/[teammateId]/save-transcription
    v
MeetingIngestionComponent.ingestTranscription(...)
    |-- [continues as Flow 3 above]
```

---

### Flow 5: Pre-Meeting Brief Generation

```
Manager Browser
    |
    | POST /api/brief/[teammateId]/generate
    v
BriefGenerationHandler.generate(managerId, teammateId)
    |-- BriefGenerationHandler.buildContext(teammateId)
    |       |-- DatabaseService.getTeammate(...)           [profile]
    |       |-- DatabaseService.listMeetings(..., limit:3) [last 3 meetings]
    |       |-- CommitmentTracker.listOpen(...)            [open commitments]
    |       |-- DatabaseService.getPatterns(...)           [active patterns]
    |-- CoachingStrategyHandler.selectFramework(profile, themes, patterns)
    |       |-- Claude API (coaching strategy prompt)
    |-- Claude API (brief generation prompt + all context + coaching recommendation)
    |-- BriefGenerationHandler.assembleBrief(claudeResponse)
    |-- returns Brief (not persisted)
```

---

### Flow 6: Commitment Lifecycle

```
[After meeting analysis completes]
MeetingAnalysisHandler
    |-- CommitmentTracker.saveSuggested(meetingId, suggestions)
    |       |-- DatabaseService.createCommitment(..., status:'suggested')

[Manager reviews suggested commitments]
    | PATCH /api/commitments/[id]  { action: 'confirm' }
    v
CommitmentTracker.confirm(managerId, commitmentId, editedText?)
    |-- DatabaseService.updateCommitment(..., status:'open')

    | PATCH /api/commitments/[id]  { action: 'dismiss' }
    v
CommitmentTracker.dismiss(managerId, commitmentId)
    |-- DatabaseService.deleteCommitment(...)

[Before next 1:1]
BriefGenerationHandler.buildContext()
    |-- CommitmentTracker.listOpen(managerId, teammateId)
    |-- CommitmentTracker.detectBrokenPattern(teammateId)
    |       |-- flags commitments carried forward 2+ consecutive times
```

---

## External Service Integration Points

| External System     | Called By                                      | Protocol          |
|---------------------|------------------------------------------------|-------------------|
| Supabase Auth       | AuthService                                    | Supabase JS SDK   |
| Supabase PostgreSQL | DatabaseService (via Prisma), AnalysisQueueService | Prisma ORM / Supabase SDK |
| Supabase Storage    | StorageService                                 | Supabase JS SDK   |
| Claude API          | InterviewAIHandler, MeetingAnalysisHandler, PatternDetectionHandler, BriefGenerationHandler, CoachingStrategyHandler, GrowthTimeline | Anthropic Node SDK |
| Whisper / Deepgram  | TranscriptionService                           | REST API          |
| Resend (Email)      | EmailService                                   | Resend Node SDK   |
| Web Push API        | PushNotificationService                        | web-push npm lib  |

---

## No Circular Dependencies Confirmation

```
AuthComponent         → AuthService, EmailService
TeammateComponent     → DatabaseService
InterviewAIHandler    → DatabaseService
MeetingIngestionComponent → DatabaseService, StorageService, AnalysisQueueService
TranscriptionComponent    → StorageService, TranscriptionService
MeetingAnalysisHandler    → DatabaseService, CommitmentTracker*, PatternDetectionHandler*, NotificationComponent*
PatternDetectionHandler   → DatabaseService
BriefGenerationHandler    → DatabaseService, CommitmentTracker, CoachingStrategyHandler
CoachingStrategyHandler   → (none — pure AI call)
CommitmentTracker         → DatabaseService
GrowthTimeline            → DatabaseService
NotificationComponent     → PushNotificationService, EmailService
AnalysisJobQueue          → AnalysisQueueService, MeetingAnalysisHandler*

* = invokes as a downstream trigger, not a circular dependency
```

All dependency arrows point downward (toward services) or laterally (component → component, one direction only). No cycles detected.
