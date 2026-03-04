# Component Methods — 1:1OS

**Date**: 2026-03-01
**Note**: Method signatures use TypeScript notation. Detailed business logic is defined in Functional Design (Construction phase). Input/output types are high-level — exact Prisma models defined during Functional Design.

---

## 1. AuthComponent

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `register(email, password)` | `string, string` | `{ managerId } \| AuthError` | Create account, hash password, create session |
| `login(email, password)` | `string, string` | `{ managerId, token } \| AuthError` | Authenticate, return JWT session token |
| `logout(token)` | `string` | `void` | Invalidate session |
| `forgotPassword(email)` | `string` | `void` | Generate reset token, send email (always returns void — no enumeration) |
| `resetPassword(token, newPassword)` | `string, string` | `void \| AuthError` | Validate token (expiry + single-use), update password |
| `validateSession(token)` | `string` | `{ managerId } \| null` | Verify JWT, return manager context |

---

## 2. TeammateComponent

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `create(managerId, name, role)` | `string, string, string` | `Teammate` | Create teammate record, initialize empty profile |
| `get(managerId, teammateId)` | `string, string` | `Teammate \| null` | Fetch full teammate with profile |
| `list(managerId)` | `string` | `Teammate[]` | All teammates for manager, ordered by name |
| `update(managerId, teammateId, fields)` | `string, string, Partial<ProfileFields>` | `Teammate` | Partial update to profile fields |
| `delete(managerId, teammateId)` | `string, string` | `void` | Delete teammate + all meetings, patterns, commitments |

---

## 3. InterviewAIHandler

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `startInterview(teammateId, name, role)` | `string, string, string` | `{ questionId, question: string }` | Begin interview — return first question |
| `nextQuestion(teammateId, questionId, answer)` | `string, string, string` | `{ questionId, question: string } \| { complete: true }` | Accept answer, generate next contextual question or signal completion |
| `generateProfile(teammateId, allAnswers)` | `string, Record<string, string>` | `ProfileFields` | Synthesize all answers into structured profile via Claude API |
| `handleFailure(teammateId)` | `string` | `ManualProfileForm` | Return empty manual profile form if Claude unavailable |

---

## 4. MeetingIngestionComponent

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `ingestPaste(managerId, teammateId, text)` | `string, string, string` | `{ meetingId } \| ValidationError` | Validate length (≥50 chars), save meeting, enqueue analysis job |
| `ingestUpload(managerId, teammateId, fileId)` | `string, string, string` | `{ meetingId } \| ParseError` | Retrieve file from storage, extract text, save meeting, enqueue job |
| `ingestTranscription(managerId, teammateId, text)` | `string, string, string` | `{ meetingId }` | Save reviewed transcription as meeting, enqueue analysis job |
| `enqueueAnalysis(meetingId)` | `string` | `void` | Delegate to AnalysisQueueService to create pending job |

---

## 5. TranscriptionComponent

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `getAudioUploadUrl(managerId)` | `string` | `{ uploadUrl, fileId }` | Generate presigned Supabase Storage URL for client audio upload |
| `transcribe(fileId)` | `string` | `{ text: string } \| TranscriptionError` | Call TranscriptionService, delete audio file after success |
| `discard(fileId)` | `string` | `void` | Delete audio file without transcribing |

---

## 6. MeetingAnalysisHandler

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `analyze(meetingId)` | `string` | `MeetingAnalysisResult` | Load meeting text + teammate profile, call Claude API, extract themes/tags/tone/commitments, persist results, update status to `analysis_complete` |
| `extractThemes(text, profile)` | `string, ProfileFields` | `Theme[]` | Claude sub-prompt: extract key discussion themes |
| `extractTags(themes)` | `Theme[]` | `CategoryTag[]` | Classify themes into category tags |
| `extractCommitments(text)` | `string` | `SuggestedCommitment[]` | Detect commitment statements, attribute to Manager or Teammate |
| `generateSummary(text)` | `string` | `string` | One-line meeting summary sentence |
| `onComplete(meetingId)` | `string` | `void` | Trigger PatternDetectionHandler + NotificationComponent |

---

## 7. PatternDetectionHandler

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `detectPatterns(teammateId)` | `string` | `Pattern[]` | Load full meeting history, call Claude API with all summaries + tags, detect patterns |
| `classifySeverity(pattern)` | `PatternCandidate` | `'informational' \| 'watch' \| 'action_required'` | Assign severity based on frequency and type |
| `persistPatterns(teammateId, patterns)` | `string, Pattern[]` | `void` | Upsert patterns, replacing previous pattern set |

---

## 8. BriefGenerationHandler

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `generate(managerId, teammateId)` | `string, string` | `Brief \| FallbackBrief` | Load context (profile + last 3 meetings + open commitments + patterns), call Claude API, assemble brief |
| `buildContext(teammateId)` | `string` | `BriefContext` | Fetch and structure all data needed for prompt |
| `assembleBrief(claudeResponse)` | `ClaudeResponse` | `Brief` | Parse Claude output into structured brief object with all required sections |
| `getFallbackBrief(teammateId)` | `string` | `FallbackBrief` | Return raw open commitments + last meeting summary when Claude unavailable |

---

## 9. CoachingStrategyHandler

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `selectFramework(profile, recentThemes, patterns)` | `ProfileFields, Theme[], Pattern[]` | `CoachingRecommendation` | Call Claude API to select framework and generate rationale |
| `getFallbackRecommendation()` | — | `CoachingRecommendation` | Return generic open-questioning suggestion when confidence is low or Claude unavailable |

**Called internally by**: BriefGenerationHandler (not a direct API endpoint)

---

## 10. CommitmentTracker

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `saveSuggested(meetingId, suggestions)` | `string, SuggestedCommitment[]` | `Commitment[]` | Persist AI-extracted commitments with status `suggested` |
| `confirm(managerId, commitmentId, editedText?)` | `string, string, string?` | `Commitment` | Change status from `suggested` to `open`, apply any text edit |
| `dismiss(managerId, commitmentId)` | `string, string` | `void` | Delete suggested commitment |
| `createManual(managerId, teammateId, text, owner, dueDate?)` | `string, string, string, 'manager'\|'teammate', Date?` | `Commitment` | Create manual commitment with status `open` |
| `updateStatus(managerId, commitmentId, status)` | `string, string, CommitmentStatus` | `Commitment` | Mark as `done`, `carried_forward`, or `dropped` |
| `listOpen(managerId, teammateId)` | `string, string` | `Commitment[]` | All commitments with status `open` or `suggested` |
| `detectBrokenPattern(teammateId)` | `string` | `BrokenCommitmentSignal[]` | Find commitments carried forward 2+ consecutive times |

---

## 11. GrowthTimeline

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `listMeetings(managerId, teammateId, filter?)` | `string, string, TagFilter?` | `MeetingEntry[]` | Reverse-chronological list with date, one-line summary, tags |
| `generateGrowthSummary(teammateId)` | `string` | `string` | On-demand Claude API call: generate current growth state paragraph from tag history |

---

## 12. NotificationComponent

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `subscribe(managerId, pushSubscription)` | `string, PushSubscription` | `void` | Store manager's Web Push subscription |
| `unsubscribe(managerId)` | `string` | `void` | Remove push subscription |
| `notifyAnalysisComplete(managerId, teammateId, meetingDate)` | `string, string, Date` | `void` | Send browser push + email notification to manager |

---

## 13. AnalysisJobQueue

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `enqueue(meetingId)` | `string` | `void` | Insert pending job record |
| `processNext()` | — | `void` | Claim one pending job, run MeetingAnalysisHandler, mark complete or failed |
| `handleFailure(jobId, meetingId, error)` | `string, string, Error` | `void` | Mark job failed, update meeting status to `analysis_failed`, notify manager |
