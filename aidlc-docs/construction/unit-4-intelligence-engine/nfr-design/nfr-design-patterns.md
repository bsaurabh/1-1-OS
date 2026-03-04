# NFR Design Patterns — Unit 4: Intelligence Engine

**Date**: 2026-03-02
**Unit**: Unit 4: Intelligence Engine

---

## P-4.01 — Chained Side-Effect with Failure Isolation

**Addresses**: Reliability — pattern detection must not fail meeting analysis

**Context**: PatternDetectionHandler is called inside `MeetingAnalysisHandler.onComplete()` after meeting status is set to `ANALYSIS_COMPLETE`. If pattern detection fails, the meeting must remain `ANALYSIS_COMPLETE`.

**Pattern**:
```typescript
// Inside MeetingAnalysisHandler.onComplete()
async function onComplete(meetingId, managerId, teammateId, result) {
  // 1. Persist meeting analysis result (critical path)
  await prisma.meeting.update({ status: 'ANALYSIS_COMPLETE', ... })
  await saveSuggested(...)

  // 2. Chain pattern detection as isolated side-effect
  try {
    await detectPatterns(teammateId, managerId)
  } catch (err) {
    // swallow — pattern detection failure does NOT affect ANALYSIS_COMPLETE
    console.error('[patternDetection] failed for teammate', teammateId, err)
  }
}
```

**Guarantees**:
- Meeting always reaches `ANALYSIS_COMPLETE` if Claude analysis succeeds
- Pattern detection failure is logged but never surfaces to the manager
- Patterns may lag 1 cron cycle on failure; recover automatically on next analysis

---

## P-4.02 — Parallel DB Pre-fetch

**Addresses**: Performance — brief generation must complete in ≤ 10s p95

**Context**: BriefGenerationHandler needs 4 separate DB reads before calling Claude. Sequential reads would add ~800ms; parallel reduces to ~200ms.

**Pattern**:
```typescript
async function generateBrief(managerId: string, teammateId: string) {
  // All 4 reads in parallel — saves ~600ms vs sequential
  const [teammate, meetings, openCommitments, patterns] = await Promise.all([
    prisma.teammate.findFirst({ where: { id: teammateId, managerId } }),
    prisma.meeting.findMany({
      where: { teammateId, managerId, status: 'ANALYSIS_COMPLETE' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.commitment.findMany({
      where: { teammateId, managerId, status: { in: ['OPEN', 'CARRIED_FORWARD'] } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.pattern.findMany({
      where: { teammateId },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
    }),
  ])

  if (!teammate) throw new Error('Teammate not found')
  if (meetings.length === 0) throw new EmptyHistoryError()

  // Then call Claude with all context assembled
  ...
}
```

**Budget breakdown**:
- `Promise.all` DB reads: ~200ms
- `CoachingStrategyHandler` (Haiku): ~2–3s
- `BriefGenerationHandler` Claude call (Sonnet): ~6–7s
- Parse + assemble: ~50ms
- Total p50: ~7s | p95: ~10s ✓

---

## P-4.03 — Graceful Degradation with Structured Fallback

**Addresses**: Reliability — brief page must never show a blank screen

**Context**: Claude Sonnet may fail, timeout, or produce unparseable output. The manager must still have useful context for their 1:1.

**Pattern**:
```typescript
async function generateBrief(managerId, teammateId) {
  const [teammate, meetings, openCommitments, patterns] = await Promise.all([...])

  try {
    const coachingApproach = await selectFramework(teammate, patterns, openCommitments)
    const prompt = buildBriefPrompt({ teammate, meetings, openCommitments, patterns, coachingApproach })
    const message = await callClaudeWithRetry(...)
    const parsed = parseBriefResponse(message.content[0].text)
    return {
      brief: { ...parsed, openCommitments: ..., patterns: ..., coachingApproach },
      fallback: null,
    }
  } catch (err) {
    console.error('[briefGeneration] failed, returning fallback', err)
    return {
      brief: null,
      fallback: buildFallback(openCommitments, meetings[0] ?? null),
    }
  }
}
```

**Fallback content** (always available — built from DB data, no Claude):
- Open + carried-forward commitments
- Last meeting summary + date (if exists)

**API response shape** (always returns 200):
```typescript
// Success
{ brief: Brief, fallback: null }

// Failure
{ brief: null, fallback: BriefFallback }

// No history
// Returns 422 { error: 'no_history' } — caught before entering generation
```

---

## P-4.04 — Tiered Claude Model Selection

**Addresses**: Performance — balance quality vs. latency within the 10s brief budget

**Context**: BriefGenerationHandler calls two Claude models sequentially. Using Sonnet for both would push total latency to ~13–14s. Using Haiku for the classification task (framework selection) saves ~4s.

**Pattern**:
```typescript
// Constants — defined per-handler, never runtime-configurable
const PATTERN_MODEL   = 'claude-haiku-4-5-20251001'   // PatternDetectionHandler
const FRAMEWORK_MODEL = 'claude-haiku-4-5-20251001'   // CoachingStrategyHandler
const BRIEF_MODEL     = 'claude-sonnet-4-6'            // BriefGenerationHandler

// Rule: Haiku for classification/selection tasks
//       Sonnet for synthesis/generation tasks
```

**Task classification**:
| Handler | Task Type | Model | Rationale |
|---------|-----------|-------|-----------|
| PatternDetectionHandler | Classification: identify patterns from list | Haiku | Constrained output; deterministic categorization |
| CoachingStrategyHandler | Classification: select from 6 frameworks | Haiku | Known option set; short output (< 500 tokens) |
| BriefGenerationHandler | Synthesis: generate full brief from context | Sonnet | Nuanced multi-section output; quality matters |

---

## P-4.05 — Bounded Collection with Severity-Weighted Eviction

**Addresses**: Scalability — prevent unbounded Pattern table growth per teammate

**Context**: Pattern detection runs after every meeting analysis. Without a cap, a highly active manager could accumulate hundreds of patterns per teammate.

**Pattern**:
```typescript
const MAX_PATTERNS = 10

async function upsertPattern(teammateId: string, detected: DetectedPattern) {
  // Check existing count
  const count = await prisma.pattern.count({ where: { teammateId } })

  if (count >= MAX_PATTERNS) {
    // Evict: least severe + oldest first
    // Priority: INFORMATIONAL (evict first) → WATCH → ACTION_REQUIRED (evict last)
    const toEvict = await prisma.pattern.findFirst({
      where: { teammateId },
      orderBy: [
        { severity: 'asc' },      // INFORMATIONAL < WATCH < ACTION_REQUIRED
        { detectedAt: 'asc' },    // oldest first within same severity
      ],
    })
    if (toEvict) {
      await prisma.pattern.delete({ where: { id: toEvict.id } })
    }
  }

  // Now create or update
  await prisma.pattern.create({ data: { teammateId, ...detected } })
}
```

**Severity ordering for eviction** (Prisma enum sorts alphabetically — handle in application logic):
- Evict `INFORMATIONAL` first (least impactful)
- Then `WATCH`
- Never evict `ACTION_REQUIRED` unless all others are gone

---

## P-4.06 — Client-Side Async Fetch with Immediate Shell

**Addresses**: Performance — avoid SSR timeout on brief generation (10s target vs. ~10s Vercel SSR practical limit)

**Context**: Brief generation can take up to 10s. If rendered via SSR, Vercel's serverless function timeout may be hit, causing a 504 error. Client-side fetch avoids this risk and improves perceived performance by showing the shell immediately.

**Pattern**:
```typescript
// pages/teammates/[id]/brief.tsx
export default function BriefPage({ teammateName, teammateId, managerEmail }: BriefPageProps) {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [fallback, setFallback] = useState<BriefFallback | null>(null)
  const [loading, setLoading] = useState(true)
  const [noHistory, setNoHistory] = useState(false)

  // Trigger generation on mount — SSR only loads shell
  useEffect(() => {
    async function generate() {
      try {
        const res = await fetch(`/api/brief/${teammateId}/generate`, { method: 'POST' })
        if (res.status === 422) { setNoHistory(true); return }
        const data = await res.json()
        if (data.brief) setBrief(data.brief)
        else setFallback(data.fallback)
      } finally {
        setLoading(false)
      }
    }
    generate()
  }, [teammateId])

  // SSR renders: AppLayout + header + spinner immediately
  // Brief populates after ~7–10s without SSR timeout risk
}
```

**Perceived performance**: First Contentful Paint < 200ms (shell). Brief appears after 7–10s. This is acceptable for a "prepare for 1:1" workflow where the manager intentionally waits.

---

## P-4.07 — Pure Brief Text Serializer

**Addresses**: Usability — clipboard copy (US-11) must produce readable plain text

**Context**: `navigator.clipboard.writeText()` requires a plain string. The `Brief` object must be serialized to a structured, human-readable format without HTML.

**Pattern**:
```typescript
export function formatBriefAsText(brief: Brief, teammateName: string): string {
  const lines: string[] = [
    `PRE-MEETING BRIEF — ${teammateName}`,
    `Generated: ${new Date(brief.generatedAt).toLocaleDateString()}`,
    '',
    '--- CONTEXT SUMMARY ---',
    brief.contextSummary,
    '',
    '--- OPEN COMMITMENTS ---',
    ...brief.openCommitments.map((c, i) =>
      `${i + 1}. [${c.owner}] ${c.text} (${c.status}${c.carryCount >= 2 ? ` — carried ${c.carryCount}x` : ''})`
    ),
    '',
    '--- ACTIVE PATTERNS ---',
    ...(brief.patterns.length > 0
      ? brief.patterns.map((p) => `• [${p.severity}] ${p.description}`)
      : ['No active patterns.']),
    '',
    '--- COACHING FOCUS ---',
    brief.coachingFocus,
    '',
    '--- COACHING APPROACH ---',
    `Framework: ${brief.coachingApproach.framework}`,
    brief.coachingApproach.rationale,
    ...brief.coachingApproach.actions.map((a) => `• ${a}`),
    '',
    '--- FOLLOW-UP QUESTIONS ---',
    ...brief.followUpQuestions.map((q, i) => `${i + 1}. ${q}`),
    '',
    '--- THE UNCOMFORTABLE QUESTION ---',
    brief.uncomfortableQuestion,
  ]

  if (brief.riskSignals.length > 0) {
    lines.splice(lines.indexOf('--- COACHING FOCUS ---'), 0,
      '--- RISK SIGNALS ---',
      ...brief.riskSignals.map((r) => `⚠ ${r}`),
      ''
    )
  }

  return lines.join('\n')
}
```

**Properties**: Pure function (no side effects), testable, no DOM/browser dependencies.

---

## Pattern Interaction Diagram

```
[Cron tick — every 1 min]
  │
  ▼
processNext(analyzeFn)
  │
  ├─► analyze(meetingId)           [Unit 3: P-3.01, P-3.02, P-3.03]
  │     │
  │     ▼
  │   meeting.status = ANALYSIS_COMPLETE
  │     │
  │     ▼
  │   onComplete()
  │     │
  │     ├─► saveSuggested()        [Unit 3]
  │     │
  │     └─► detectPatterns()       [P-4.01 — isolated side-effect]
  │           │
  │           ├─ if meetings < 2 → return (no-op)
  │           ├─ Claude Haiku → parsePatternResponse()
  │           └─ upsertPattern() × N    [P-4.05 — bounded, evict if ≥10]
  │
  └─► notifyAnalysisComplete()     [Unit 3: P-3.06]

──────────────────────────────────────────────────────

[Manager clicks "Prepare for 1:1"]
  │
  ▼
Browser loads /teammates/[id]/brief   [P-4.06 — SSR shell only]
  │
  ▼
useEffect → POST /api/brief/[id]/generate
  │
  ▼
BriefGenerationHandler
  │
  ├─► Promise.all([teammate, meetings, commitments, patterns])  [P-4.02]
  │
  ├─► CoachingStrategyHandler.selectFramework()  [P-4.04 — Haiku]
  │     └─► callClaudeWithRetry(FRAMEWORK_MODEL)
  │         └─ on error → fallbackApproach()
  │
  ├─► buildBriefPrompt(fullContext)
  │
  ├─► callClaudeWithRetry(BRIEF_MODEL)           [P-4.04 — Sonnet]
  │     └─ parseBriefResponse()
  │
  ├─ success → { brief: Brief, fallback: null }  [P-4.03]
  └─ any error → { brief: null, fallback: BriefFallback }  [P-4.03]
  │
  ▼
Browser renders BriefView or BriefFallbackView
```
