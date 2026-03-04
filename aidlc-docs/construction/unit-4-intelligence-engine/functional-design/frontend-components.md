# Frontend Components — Unit 4: Intelligence Engine

**Date**: 2026-03-02
**Unit**: Unit 4: Intelligence Engine

---

## Component Hierarchy

```
pages/teammates/[id]/index.tsx         [MODIFIED — add Patterns section]
  └── PatternList                      [NEW]
        └── PatternCard                [NEW]

pages/teammates/[id]/brief.tsx         [NEW]
  └── AppLayout
        └── BriefView                  [NEW]
              ├── BriefSection         [NEW — generic section wrapper]
              ├── CommitmentListMini   [NEW — read-only commitment summary]
              ├── PatternSignals       [NEW — brief's pattern section]
              ├── QuestionList         [NEW — follow-up questions]
              └── CoachingApproachCard [NEW]
        └── BriefFallbackView          [NEW]
```

---

## Component Specifications

---

### PatternList

**File**: `components/patterns/PatternList.tsx`
**Purpose**: Displays all detected patterns for a teammate on the profile page.

**Props**:
```typescript
interface PatternListProps {
  patterns: Pattern[]
  meetingCount: number
}
```

**State**: None (pure display).

**Render logic**:
- If `meetingCount < 2`: render empty state — "Not enough meeting data yet. Patterns will appear after 2 or more meetings are recorded."
- If `meetingCount >= 2` and `patterns.length === 0`: render — "No recurring patterns detected yet."
- Otherwise: render list of `PatternCard` components, sorted by severity (ACTION_REQUIRED → WATCH → INFORMATIONAL).

**Data-testids**:
- `data-testid="pattern-list"` — wrapper div
- `data-testid="pattern-empty-state"` — empty state message
- `data-testid="pattern-no-history"` — < 2 meetings state

**API**: None (data passed as props from SSR).

---

### PatternCard

**File**: `components/patterns/PatternCard.tsx`
**Purpose**: Single pattern row with severity badge and evidence details.

**Props**:
```typescript
interface PatternCardProps {
  pattern: {
    id: string
    description: string
    severity: 'INFORMATIONAL' | 'WATCH' | 'ACTION_REQUIRED'
    evidence: { meetingIds: string[]; dates: string[]; tags: string[] }
    detectedAt: string
  }
}
```

**State**: `expanded: boolean` (default false) — toggles evidence detail.

**Severity badge colors**:
- INFORMATIONAL → blue badge
- WATCH → amber badge
- ACTION_REQUIRED → red badge

**Data-testids**:
- `data-testid="pattern-card-{id}"`
- `data-testid="pattern-severity-{id}"`
- `data-testid="pattern-description-{id}"`
- `data-testid="pattern-expand-{id}"` — expand button

---

### BriefView

**File**: `components/brief/BriefView.tsx`
**Purpose**: Full pre-meeting brief display with all sections.

**Props**:
```typescript
interface BriefViewProps {
  brief: Brief
  teammateName: string
  onRegenerate: () => void
  isRegenerating: boolean
}
```

**State**: None (fully controlled by page).

**Sections rendered** (in order):
1. Header: teammate name + "Regenerate Brief" button + "Copy to Clipboard" button
2. Context Summary (BriefSection)
3. Open Commitments (CommitmentListMini)
4. Active Pattern Signals (PatternSignals)
5. Risk Signals (BriefSection — conditional, only if riskSignals.length > 0)
6. Suggested Coaching Focus (BriefSection)
7. Coaching Approach (CoachingApproachCard)
8. Follow-Up Questions (QuestionList)
9. The "Uncomfortable Question" (highlighted block)

**Data-testids**:
- `data-testid="brief-view"` — wrapper
- `data-testid="brief-context-summary"`
- `data-testid="brief-coaching-focus"`
- `data-testid="brief-uncomfortable-question"`
- `data-testid="brief-regenerate-btn"`
- `data-testid="brief-copy-btn"`

**Clipboard action** (US-11):
```typescript
async function handleCopy() {
  const text = formatBriefAsText(brief, teammateName)
  await navigator.clipboard.writeText(text)
  showToast('Brief copied.')
}
```

---

### BriefFallbackView

**File**: `components/brief/BriefFallbackView.tsx`
**Purpose**: Shown when brief generation fails. Displays raw fallback data.

**Props**:
```typescript
interface BriefFallbackViewProps {
  fallback: BriefFallback
  onRetry: () => void
}
```

**State**: None.

**Renders**:
- Warning banner: "Brief generation failed. Here is a summary of open commitments and last meeting notes to help you prepare."
- Open commitments list (if any)
- Last meeting summary + date (if available)
- "Try Again" button → calls `onRetry()`

**Data-testids**:
- `data-testid="brief-fallback-view"`
- `data-testid="brief-fallback-retry"`

---

### CoachingApproachCard

**File**: `components/brief/CoachingApproachCard.tsx`
**Purpose**: Displays the coaching framework section of the brief.

**Props**:
```typescript
interface CoachingApproachCardProps {
  approach: CoachingApproach
}
```

**State**: None.

**Renders**:
- Framework name badge (e.g., "GROW Framework")
- Rationale text (2–3 sentences)
- Coaching actions list (1–2 items)

**Data-testids**:
- `data-testid="coaching-approach-card"`
- `data-testid="coaching-framework-name"`
- `data-testid="coaching-rationale"`

---

### QuestionList

**File**: `components/brief/QuestionList.tsx`
**Purpose**: Numbered list of follow-up questions.

**Props**:
```typescript
interface QuestionListProps {
  questions: string[]
}
```

**State**: None.

**Renders**: Numbered list, each question on its own line.

**Data-testids**:
- `data-testid="question-list"`
- `data-testid="question-{index}"` (0-indexed)

---

### CommitmentListMini

**File**: `components/brief/CommitmentListMini.tsx`
**Purpose**: Read-only compact commitment list for the brief.

**Props**:
```typescript
interface CommitmentListMiniProps {
  commitments: BriefCommitment[]
}
```

**State**: None.

**Renders**:
- If empty: "No open commitments."
- Otherwise: compact list with owner badge + status chip (OPEN / CARRIED_FORWARD)
- CARRIED_FORWARD commitments highlighted with carryCount badge if carryCount >= 2.

**Data-testids**:
- `data-testid="commitment-mini-list"`
- `data-testid="commitment-mini-{index}"`

---

### PatternSignals

**File**: `components/brief/PatternSignals.tsx`
**Purpose**: Compact pattern list for the brief (WATCH + ACTION_REQUIRED only).

**Props**:
```typescript
interface PatternSignalsProps {
  patterns: BriefPattern[]
}
```

**State**: None.

**Renders**:
- If empty: "No active pattern signals."
- Otherwise: compact list with severity badge + description.

**Data-testids**:
- `data-testid="pattern-signals"`
- `data-testid="pattern-signal-{index}"`

---

## Pages

---

### pages/teammates/[id]/index.tsx — MODIFIED

**Change**: Add Patterns section below ProfileView, loaded from SSR.

**New SSR data**:
- `patterns: Pattern[]` — all patterns for teammate, ordered by severity DESC
- `meetingCount: number` — count of ANALYSIS_COMPLETE meetings (to drive empty state)
- "Prepare" button linking to `/teammates/[id]/brief` (to trigger brief generation)

**New state**: None needed (SSR).

**New UI elements**:
- "Patterns" section heading with `PatternList` component
- "Prepare for 1:1" button (`data-testid="prepare-brief-btn"`) → navigates to brief page

---

### pages/teammates/[id]/brief.tsx — NEW

**Purpose**: Pre-meeting brief page. Generates brief on load, supports regenerate and copy.

**SSR**: Minimal — verifies teammate ownership. Does not generate brief on server (to avoid 10s SSR timeout risk — brief generation can take up to 10s).

**Client-side**: On mount, calls `POST /api/brief/[teammateId]/generate` via `useEffect`.

**State**:
```typescript
const [brief, setBrief] = useState<Brief | null>(null)
const [fallback, setFallback] = useState<BriefFallback | null>(null)
const [loading, setLoading] = useState(true)
const [noHistory, setNoHistory] = useState(false)
const [isRegenerating, setIsRegenerating] = useState(false)
const [toastMessage, setToastMessage] = useState<string | null>(null)
```

**User interactions**:
- Page loads → auto-generate brief (spinner shown during generation)
- "Regenerate Brief" → calls generate endpoint again, replaces brief
- "Copy to Clipboard" → copies formatted brief text, shows toast "Brief copied."
- "← Back to profile" → router.push(`/teammates/[id]`)

**Render logic**:
- loading → `<LoadingSpinner />` with message "Generating your brief…"
- noHistory → empty state message with link to add meeting
- brief !== null → `<BriefView brief={brief} ... />`
- fallback !== null → `<BriefFallbackView fallback={fallback} onRetry={handleGenerate} />`

**Data-testids**:
- `data-testid="brief-page"` — page wrapper
- `data-testid="brief-loading"` — spinner state
- `data-testid="brief-no-history"` — empty history state

---

## User Interaction Flows

### Flow 1: View Patterns

```
Manager navigates to /teammates/[id]
  → SSR loads patterns + meetingCount
  → PatternList rendered with PatternCard items
  → Manager clicks PatternCard → evidence details expand
```

### Flow 2: Generate Pre-Meeting Brief

```
Manager clicks "Prepare for 1:1" on /teammates/[id]
  → Navigate to /teammates/[id]/brief
  → Page mounts → auto-call POST /api/brief/[id]/generate
  → Spinner shown
  → On success: BriefView rendered (all sections)
  → On failure: BriefFallbackView rendered
```

### Flow 3: Regenerate Brief

```
Manager clicks "Regenerate Brief" on brief page
  → isRegenerating = true (button disabled, brief greyed)
  → POST /api/brief/[id]/generate called again
  → On response: new brief replaces old brief
  → isRegenerating = false
```

### Flow 4: Copy Brief

```
Manager clicks "Copy to Clipboard" on brief page
  → formatBriefAsText(brief) → plain text string
  → navigator.clipboard.writeText(text)
  → Toast: "Brief copied." shown for 3 seconds
```
