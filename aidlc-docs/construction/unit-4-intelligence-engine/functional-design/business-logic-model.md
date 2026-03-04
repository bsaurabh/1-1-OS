# Business Logic Model — Unit 4: Intelligence Engine

**Date**: 2026-03-02
**Unit**: Unit 4: Intelligence Engine

---

## Component: PatternDetectionHandler

### Trigger

Called from `MeetingAnalysisHandler.onComplete()` after a meeting achieves `ANALYSIS_COMPLETE` status. Runs inside the cron function (60s budget shared with analysis).

### Algorithm

```
detectPatterns(teammateId, managerId):
  1. Load all ANALYSIS_COMPLETE meetings for teammate
     (ordered by createdAt ASC)
  2. If meetings.length < 2 → return early (no patterns possible)
  3. Build patternContext:
     - All themes (aggregated)
     - All tags (with frequency counts)
     - All tones (list)
     - Meeting summaries (last 5, truncated to 500 chars each)
  4. Call Claude (claude-sonnet-4-6) with buildPatternPrompt(patternContext, teammateName)
  5. parsePatternResponse(claudeText) → DetectedPattern[]
  6. For each DetectedPattern:
     a. Check if a similar pattern already exists in DB
        (fuzzy: same severity + overlapping tags)
     b. If new → prisma.pattern.create(...)
     c. If updated → prisma.pattern.update({ description, evidence, detectedAt })
  7. Return upserted patterns count
```

### Claude Prompt Design

`buildPatternPrompt(context, teammateName)`:
- Includes: aggregated themes, tag frequencies, tone list, recent summaries
- Asks Claude to identify 2–5 patterns with severity and evidence references
- Requests JSON array output
- VALID_SEVERITIES: `['INFORMATIONAL', 'WATCH', 'ACTION_REQUIRED']`

### Pattern Deduplication Logic

Two patterns are considered the same if:
- Severity matches exactly AND
- At least 2 of the same tags appear in evidence

If match found: update description + evidence (add new meeting IDs) + refresh detectedAt.
If no match: create new Pattern row.

---

## Component: CoachingStrategyHandler

### Purpose

Selects the most appropriate coaching framework for a specific teammate in their current situation. Called by BriefGenerationHandler — not a standalone API endpoint.

### Algorithm

```
selectFramework(teammate, recentPatterns, openCommitments):
  1. Build selectionContext:
     - teammate.profile fields (strengths, growthAreas, feedbackStyle, motivationDrivers)
     - recentPatterns (severity + description, last 5)
     - openCommitments count + carryCount distributions
  2. Call Claude (claude-haiku-4-5) with buildFrameworkSelectionPrompt(selectionContext)
  3. parseFrameworkResponse(claudeText) → CoachingApproach
  4. If parse fails or confidence is low → return fallbackApproach()
```

### Fallback

```
fallbackApproach():
  return {
    framework: 'General Open-Ended',
    rationale: 'Not enough context to recommend a specific framework. Consider asking open-ended questions about what\'s going well and what feels hard right now.',
    actions: [
      'Ask: "What\'s one thing that energized you this week?"',
      'Ask: "What\'s one thing that felt harder than it should have?"'
    ]
  }
```

### Framework Selection Rules (given to Claude)

| Situation | Recommended Framework |
|-----------|----------------------|
| Goal or aspiration discussed recently | GROW |
| Negative feedback to deliver / conflict pattern | SBI |
| Low motivation or morale signals | STRENGTHS or MOTIVATIONAL |
| Blocker / stuck pattern | OSCAR |
| Repeated same decisions / self-awareness gap | SOCRATIC |
| Ambivalence about direction | MOTIVATIONAL |

---

## Component: BriefGenerationHandler

### Purpose

Assembles all context and calls Claude to produce the full Pre-Meeting Brief. Single API endpoint: `POST /api/brief/[teammateId]/generate`.

### Algorithm

```
generateBrief(managerId, teammateId):
  1. Load all required data in parallel:
     a. teammate (profile)
     b. meetings: last 10 ANALYSIS_COMPLETE, ordered by createdAt DESC
     c. openCommitments: status IN ['OPEN', 'CARRIED_FORWARD'], ordered by createdAt ASC
     d. patterns: all for teammate, ordered by severity DESC, detectedAt DESC

  2. Guard: if meetings.length === 0
     → throw EmptyHistoryError (caller renders "no history" state)

  3. Select coaching framework:
     coachingApproach = CoachingStrategyHandler.selectFramework(
       teammate, patterns.slice(0, 5), openCommitments
     )

  4. Build briefContext:
     - lastMeeting: meetings[0] (summary, tags, tone, themes, createdAt)
     - allMeetings: meetings (for open threads analysis)
     - openCommitments: mapped to BriefCommitment[]
     - activePatterns: patterns filtered to WATCH + ACTION_REQUIRED
     - informationalPatterns: patterns filtered to INFORMATIONAL
     - teammateName, profile
     - coachingApproach (already selected)

  5. Call Claude (claude-sonnet-4-6):
     buildBriefPrompt(briefContext) → prompt
     callClaudeWithRetry(sonnet, prompt, max_tokens: 3000)

  6. parseBriefResponse(claudeText) → Brief

  7. Merge coachingApproach into Brief.coachingApproach

  8. Return { brief: Brief, fallback: null }

  CATCH any error:
     Return { brief: null, fallback: buildFallback(openCommitments, meetings[0]) }
```

### Brief Prompt Structure

`buildBriefPrompt(context)` produces a prompt asking Claude to return JSON with:
```json
{
  "contextSummary": "...",
  "coachingFocus": "...",
  "riskSignals": ["..."],
  "followUpQuestions": ["...", "...", "...", "...", "..."],
  "uncomfortableQuestion": "..."
}
```

Note: `coachingApproach` and `openCommitments` and `patterns` are assembled directly from DB data — not generated by Claude — to ensure accuracy.

### Fallback Builder

```
buildFallback(openCommitments, lastMeeting):
  return {
    commitments: openCommitments.map(toBriefCommitment),
    lastMeetingSummary: lastMeeting?.summary ?? null,
    lastMeetingDate: lastMeeting?.createdAt.toISOString() ?? null,
  }
```

---

## Integration: Pattern Detection Chain (Unit 3 → Unit 4)

```
[Cron tick]
  → processNext(analyzeFn)
    → analyze(meetingId)               [Unit 3]
      → Claude analysis
      → meeting.status = ANALYSIS_COMPLETE
      → saveSuggested(commitments)
    → onComplete(meetingId, ...)
      → [NEW Unit 4] detectPatterns(teammateId, managerId)
        → if meetings >= 2 → Claude pattern analysis
        → upsert Pattern rows
    → notifyAnalysisComplete(...)      [Unit 3]
```

The cron function's 60s maxDuration is shared. PatternDetectionHandler uses a separate Claude call (Haiku for speed). Total budget: ~5s analysis + ~8s patterns + ~2s notifications = ~15s typical, well within 60s.

---

## Data Flow: Brief Generation (US-10)

```
Manager clicks "Prepare"
  ↓
Browser → POST /api/brief/[teammateId]/generate
  ↓
BriefGenerationHandler.generateBrief(managerId, teammateId)
  ↓ (parallel DB reads)
  ├── teammate profile
  ├── last 10 meetings
  ├── open+carried commitments
  └── all patterns
  ↓
CoachingStrategyHandler.selectFramework(...)   [Claude Haiku]
  ↓
buildBriefPrompt(fullContext)
  ↓
callClaudeWithRetry(sonnet, prompt)            [Claude Sonnet]
  ↓
parseBriefResponse(text)
  ↓ (success)
{ brief: Brief }
  ↓ (failure)
{ brief: null, fallback: BriefFallback }
  ↓
Browser renders BriefView or FallbackView
```
