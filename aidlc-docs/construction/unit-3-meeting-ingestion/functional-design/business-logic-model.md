# Business Logic Model — Unit 3: Meeting Ingestion

**Date**: 2026-03-02
**Unit**: Unit 3: Meeting Ingestion

---

## Component: MeetingIngestionComponent

Handles all three ingestion paths. Always follows the pattern: **validate → extract text → save Meeting (PENDING_ANALYSIS) → enqueue AnalysisJob**.

---

### `ingestPaste(managerId, teammateId, text)`

```
1. Validate: text.trim().length >= 50
   → If < 50: throw ValidationError("Please add more detail — at least 50 characters required for meaningful analysis.")
2. Verify teammate ownership: getTeammate(managerId, teammateId)
   → If not found: throw NotFoundError
3. Save Meeting: { managerId, teammateId, rawText: text.trim(), source: PASTE, status: PENDING_ANALYSIS }
4. enqueueAnalysis(meetingId)
5. Return { meetingId }
```

---

### `ingestUpload(managerId, teammateId, file)`

```
1. Validate file type: extension must be .txt, .docx, or .pdf
   → If not: throw ValidationError("Only .txt, .docx, and .pdf files are supported.")
2. Validate file size: file.size <= 10 * 1024 * 1024 (10MB)
   → If > 10MB: throw ValidationError("File size exceeds 10MB limit. Please upload a smaller file.")
3. Verify teammate ownership
4. Extract text from file:
   - .txt  → Buffer.toString('utf-8')
   - .docx → mammoth.extractRawText({ buffer }) → result.value
   - .pdf  → pdf-parse(buffer) → data.text
5. Validate extracted text: if empty after trim → throw ParseError("No readable text found in file.")
6. Save Meeting: { managerId, teammateId, rawText: extractedText, source: UPLOAD, status: PENDING_ANALYSIS }
7. enqueueAnalysis(meetingId)
8. Return { meetingId }
```

---

### `ingestTranscription(managerId, teammateId, reviewedText)`

```
1. Validate: reviewedText.trim().length > 0
2. Verify teammate ownership
3. Save Meeting: { managerId, teammateId, rawText: reviewedText.trim(), source: VOICE, status: PENDING_ANALYSIS }
4. enqueueAnalysis(meetingId)
5. Return { meetingId }
```
> Audio file deletion is handled by `TranscriptionComponent.transcribe()` before this is called.

---

### `enqueueAnalysis(meetingId)`

```
1. Create AnalysisJob: { meetingId, status: PENDING, retryCount: 0 }
```
Delegates to `AnalysisQueueService.enqueue(meetingId)`.

---

## Component: TranscriptionComponent

Manages the audio lifecycle: presigned upload URL → transcribe via Whisper → delete audio.

---

### `getAudioUploadUrl(managerId)`

```
1. Generate a unique fileId (cuid)
2. Call StorageService.createPresignedUploadUrl(bucket: 'voice-recordings', path: `${managerId}/${fileId}`)
3. Return { uploadUrl, fileId }
```
The client uploads audio directly to Supabase Storage using this URL — no audio data passes through the Next.js function.

---

### `transcribe(fileId, managerId)`

```
1. Retrieve audio file from Supabase Storage: StorageService.downloadFile('voice-recordings', `${managerId}/${fileId}`)
   → If not found: throw TranscriptionError("Audio file not found.")
2. Call TranscriptionService.transcribe(audioBuffer, mimeType)
   → OpenAI Whisper API: openai.audio.transcriptions.create({ file, model: 'whisper-1' })
   → If fails: throw TranscriptionError("Transcription failed. Please paste your notes manually or try again.")
3. Delete audio file from storage: StorageService.deleteFile('voice-recordings', `${managerId}/${fileId}`)
4. Return { text: transcribedText }
```

---

### `discard(fileId, managerId)`

```
1. Delete audio file from storage: StorageService.deleteFile('voice-recordings', `${managerId}/${fileId}`)
```
No meeting record is created. No errors surfaced to user if file already gone.

---

## Component: MeetingAnalysisHandler

Core AI analysis logic. Called exclusively by `AnalysisJobQueue.processNext()` — never called directly from an API route.

---

### `analyze(meetingId)`

```
1. Load meeting: prisma.meeting.findUnique({ where: { id: meetingId }, include: { teammate: true } })
   → teammate.name and teammate.profile used to personalize the prompt
2. Build analysis prompt: buildAnalysisPrompt(meeting.rawText, teammate.name, teammate.profile)
3. Call Claude API: callClaudeWithRetry(prompt, model: 'claude-sonnet-4-6')
   → Returns raw text response
4. Parse response: parseAnalysisResponse(rawText)
   → JSON.parse + regex fallback
   → If still unparseable: throw AnalysisParseError
5. Persist analysis results:
   prisma.meeting.update({
     where: { id: meetingId },
     data: {
       status: ANALYSIS_COMPLETE,
       themes: result.themes,
       tags:   result.tags,
       tone:   result.tone,
       summary: result.summary,
     }
   })
6. Persist commitment suggestions: CommitmentTracker.saveSuggested(meetingId, managerId, teammateId, result.commitments)
7. Call onComplete(meetingId, managerId, teammateId)
8. Return MeetingAnalysisResult
```

---

### `buildAnalysisPrompt(rawText, teammateName, profile)`

Single structured prompt instructing Claude to return a JSON object:

```
System: You are analyzing a manager's 1:1 meeting notes about [teammateName].
        Profile context: [profile fields if available].
        Return ONLY valid JSON matching this schema:
        {
          "themes": [{ "title": "...", "description": "..." }],  // 2–5 themes
          "tags": ["growth"],                                      // 1–3 from: growth, delivery, relationships, wellbeing, strategy, feedback, process, recognition
          "tone": "...",                                           // one word or short phrase
          "summary": "...",                                        // one sentence
          "commitments": [{ "text": "...", "owner": "MANAGER" }]  // may be []
        }

User: [rawText]
```

Attribution guidance in prompt: "I will..." or "I'll..." → `MANAGER`; "[teammateName] will..." or "[name] will..." → `TEAMMATE`; ambiguous → `MANAGER` as default.

---

### `parseAnalysisResponse(rawText)`

```
1. JSON.parse(rawText)
2. If fails: regex extract /\{[\s\S]*\}/ → JSON.parse match
3. If still fails: throw AnalysisParseError (will cause job to fail + retry)
```

---

### `onComplete(meetingId, managerId, teammateId)`

```
1. Update AnalysisJob: { status: COMPLETE, processedAt: now() }
2. Update Meeting.status: ANALYSIS_COMPLETE (already done in analyze() step 5)
3. Call NotificationComponent.notifyAnalysisComplete(managerId, teammateId, meeting.createdAt)
```

---

## Component: AnalysisJobQueue

Runs on every Vercel cron tick (every 30s). Claims and processes one job per invocation.

---

### `enqueue(meetingId)`

```
1. prisma.analysisJob.create({ data: { meetingId, status: PENDING, retryCount: 0 } })
```

---

### `processNext()`

```
1. Claim one job atomically:
   UPDATE analysis_jobs
   SET status = 'PROCESSING'
   WHERE id = (
     SELECT id FROM analysis_jobs
     WHERE status = 'PENDING'
       OR (status = 'FAILED' AND "retryCount" < 2)
     ORDER BY "createdAt" ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED
   )
   RETURNING *
   → If no row: return (nothing to process)

2. Call MeetingAnalysisHandler.analyze(job.meetingId)
   → If succeeds: mark job COMPLETE (done in analyze → onComplete)
   → If throws: call handleFailure(job.id, job.meetingId, error, job.retryCount)
```

---

### `handleFailure(jobId, meetingId, error, retryCount)`

```
1. newRetryCount = retryCount + 1
2. If newRetryCount < 2:
   → Update job: { status: FAILED, retryCount: newRetryCount, error: error.message }
   → Meeting.status stays PENDING_ANALYSIS (will retry)
3. If newRetryCount >= 2:
   → Update job: { status: FAILED, retryCount: newRetryCount, error: error.message }
   → Update Meeting: { status: ANALYSIS_FAILED }
   → Load meeting.managerId and meeting.teammateId
   → NotificationComponent.notifyAnalysisFailed(managerId, teammateId)
```

---

## Component: CommitmentTracker (Unit 3 subset)

Unit 3 only handles: AI-extracted suggestions, confirm, dismiss. Full lifecycle in Unit 5.

---

### `saveSuggested(meetingId, managerId, teammateId, suggestions)`

```
1. For each suggestion in suggestions:
   prisma.commitment.create({
     data: {
       managerId, teammateId,
       meetingId,
       text:   suggestion.text,
       owner:  suggestion.owner,   // MANAGER | TEAMMATE
       status: SUGGESTED,
       carryCount: 0,
     }
   })
2. Return created Commitment[]
```

---

### `confirm(managerId, commitmentId, editedText?)`

```
1. Verify ownership: commitment.managerId === managerId AND commitment.status === SUGGESTED
2. prisma.commitment.update({
     where: { id: commitmentId },
     data: {
       status: OPEN,
       text: editedText?.trim() ?? existing.text,  // apply edit if provided
     }
   })
3. Return updated Commitment
```

---

### `dismiss(managerId, commitmentId)`

```
1. Verify ownership and status === SUGGESTED
2. prisma.commitment.delete({ where: { id: commitmentId } })
```

---

### `listSuggested(managerId, teammateId)`

```
1. prisma.commitment.findMany({
     where: { managerId, teammateId, status: SUGGESTED },
     orderBy: { createdAt: 'asc' }
   })
```

---

## Component: NotificationComponent

---

### `subscribe(managerId, pushSubscriptionObject)`

```
1. prisma.pushSubscription.upsert({
     where: { managerId },
     create: { managerId, subscription: pushSubscriptionObject },
     update: { subscription: pushSubscriptionObject },
   })
```

---

### `unsubscribe(managerId)`

```
1. prisma.pushSubscription.deleteMany({ where: { managerId } })
```

---

### `notifyAnalysisComplete(managerId, teammateId, meetingDate)`

```
1. Load manager push subscription: prisma.pushSubscription.findUnique({ where: { managerId } })
2. Load teammate name: prisma.teammate.findFirst({ where: { id: teammateId } })
3. Load manager email: prisma.manager.findUnique({ where: { id: managerId } })

4. If pushSub exists:
   → webPush.sendNotification(pushSub.subscription, JSON.stringify({
       title: "Analysis complete",
       body: `Your 1:1 with ${teammateName} has been analyzed.`,
       url: `/teammates/${teammateId}`
     }))
   → Catch push errors silently (subscription may have expired)

5. Send email via Resend:
   → emailService.sendAnalysisCompleteEmail(managerEmail, teammateName, teammateId, meetingDate)
   → Catch email errors silently (do not fail the cron job)
```

---

### `notifyAnalysisFailed(managerId, teammateId)`

```
1. Load manager email and teammate name (same as above)
2. Send email via Resend:
   → emailService.sendAnalysisFailedEmail(managerEmail, teammateName)
   → No browser push for failures (less urgent)
```

---

## File Parsing Utilities

These are pure functions used inside `ingestUpload()`.

### `parseTextFromFile(buffer, mimeType)`

```
switch (mimeType / extension):
  case 'text/plain' (.txt):
    return buffer.toString('utf-8').trim()
  case .docx:
    result = await mammoth.extractRawText({ buffer })
    return result.value.trim()
  case .pdf:
    data = await pdfParse(buffer)
    return data.text.trim()
  default:
    throw ValidationError("Only .txt, .docx, and .pdf files are supported.")
```

---

## Key Invariants

1. **A Meeting is always saved before analysis is enqueued** — notes are never lost even if Claude is unavailable.
2. **One AnalysisJob per Meeting** — schema enforces uniqueness on `meetingId`.
3. **Audio files are always deleted** — either after successful transcription (`transcribe`) or on explicit discard (`discard`). No orphaned audio.
4. **Cron processes one job at a time** — `FOR UPDATE SKIP LOCKED` prevents concurrent cron invocations from double-processing.
5. **Notifications fire async** — push/email errors are caught and logged, never propagated to the cron job result.
