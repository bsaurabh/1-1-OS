# Frontend Components — Unit 5: Tracker & Timeline

**Date**: 2026-03-02
**Unit**: Unit 5: Tracker & Timeline

---

## Pages

### pages/teammates/[id]/commitments.tsx

**Purpose**: Full commitment tracker for a teammate — view active + resolved commitments, add manual commitments, update statuses.

**SSR (getServerSideProps)**:
- withAuth → managerId
- Fetch: `prisma.teammate.findFirst({ where: { id, managerId } })` — if not found, return notFound
- Return: `{ teammateName, teammateId, managerEmail }`
- Note: Commitments are loaded client-side via fetch to avoid SSR timeout on status updates

**Client State**:
```
openCommitments:     Commitment[]    // OPEN + CARRIED_FORWARD
resolvedCommitments: Commitment[]    // DONE + DROPPED (last 20)
loading:             boolean
showResolved:        boolean         // toggle state
isAddModalOpen:      boolean
toastMessage:        string | null
```

**On Mount**: Fetch `GET /api/commitments/[teammateId]?status=open` and `?status=resolved`

**Layout**:
```
[Header: ← Back | Teammate name]
[Tab nav: Profile | Timeline | Commitments | Brief]
[+ Add Commitment button]
[Active Commitments section]
  [CommitmentList commitments={openCommitments}]
  [BrokenPatternSignals commitments={openCommitments}]
[Resolved section (collapsible)]
  [CommitmentList commitments={resolvedCommitments} showResolved]
[AddCommitmentModal (conditional)]
[Toast (conditional)]
```

**data-testids**: `commitments-page`, `add-commitment-btn`, `show-resolved-btn`

---

### pages/teammates/[id]/timeline.tsx

**Purpose**: Growth timeline — reverse-chronological meeting list with tag filter and on-demand AI growth summary.

**SSR (getServerSideProps)**:
- withAuth → managerId
- Fetch: `prisma.teammate.findFirst({ where: { id, managerId } })` — if not found, return notFound
- Return: `{ teammateName, teammateId, managerEmail }`

**Client State**:
```
meetings:        TimelineMeetingEntry[]
loading:         boolean
activeTag:       string | null
summary:         GrowthSummary | null
summaryLoading:  boolean
```

**On Mount**: Fetch `GET /api/timeline/[teammateId]`

**Layout**:
```
[Header: ← Back | Teammate name]
[Tab nav: Profile | Timeline | Commitments | Brief]
["Generate Growth Summary" button | summary panel (conditional)]
[TagFilter chips]
[TimelineList meetings={meetings} activeTag={activeTag}]
```

**data-testids**: `timeline-page`, `generate-summary-btn`, `summary-panel`, `timeline-list`, `timeline-empty`

---

## New Components

### components/commitments/CommitmentCard.tsx

**Props**:
```typescript
interface CommitmentCardProps {
  commitment: {
    id: string
    text: string
    owner: 'MANAGER' | 'TEAMMATE'
    status: 'OPEN' | 'CARRIED_FORWARD' | 'DONE' | 'DROPPED'
    carryCount: number
    dueDate: string | null
    createdAt: string
  }
  onAction: (id: string, action: string) => void
  showActions?: boolean   // false for resolved commitments
}
```

**State**: `isLoading: boolean`

**Layout**:
```
[Owner badge] [Status chip] [Text] [Due date (if any)]
[carryCount badge if >= 2: "Carried Nx"]
Actions (if showActions):
  - OPEN:            [Mark Done] [Carry Forward] [Drop]
  - CARRIED_FORWARD: [Mark Done] [Carry Forward] [Drop]
```

**data-testids**: `commitment-card-{id}`, `commitment-owner-{id}`, `commitment-status-{id}`, `commitment-text-{id}`, `commitment-done-{id}`, `commitment-carry-{id}`, `commitment-drop-{id}`

**Styling**:
- CARRIED_FORWARD + carryCount >= 2: amber left border
- DONE: muted text
- DROPPED: strikethrough text

---

### components/commitments/CommitmentList.tsx

**Props**:
```typescript
interface CommitmentListProps {
  commitments: Commitment[]
  onAction: (id: string, action: string) => void
  showActions?: boolean
  emptyMessage?: string
}
```

**Renders**:
- Empty state if commitments.length === 0: `emptyMessage` or "No open commitments."
- List of `<CommitmentCard>` for each commitment

**data-testids**: `commitment-list`, `commitment-list-empty`

---

### components/commitments/AddCommitmentModal.tsx

**Props**:
```typescript
interface AddCommitmentModalProps {
  teammateId: string
  onSuccess: (commitment: Commitment) => void
  onClose: () => void
}
```

**State**:
```
text:          string
owner:         'MANAGER' | 'TEAMMATE'   // default MANAGER
dueDate:       string                   // empty string = no due date
isSubmitting:  boolean
duplicateInfo: { existingId: string } | null
```

**Layout**:
```
[Modal overlay]
  [Title: "Add Commitment"]
  [Owner toggle: Manager | Teammate]
  [Text area (required)]
  [Due date picker (optional)]
  [Save button (disabled if text empty or isSubmitting)]
  [Cancel button]
  [Duplicate warning (if duplicateInfo set):
    "A similar open commitment already exists.
     [Add Another] [Update Existing]"]
```

**Submit logic**:
1. POST /api/commitments/[teammateId] { text, owner, dueDate }
2. 201 → onSuccess(commitment)
3. 409 { duplicate: true, existingId } → set duplicateInfo
4. Other error → show inline error message

**data-testids**: `add-commitment-modal`, `commitment-text-input`, `commitment-owner-toggle`, `commitment-submit-btn`, `commitment-duplicate-warning`

---

### components/commitments/BrokenPatternSignals.tsx

**Props**:
```typescript
interface BrokenPatternSignalsProps {
  commitments: Commitment[]  // OPEN + CARRIED_FORWARD
}
```

**Behavior**:
- Filters commitments where `carryCount >= 2`
- Renders nothing if no broken patterns
- For each: shows amber warning card with text:
  "Commitment '[text truncated at 60 chars]' has been carried forward [N] times — consider discussing this directly."

**data-testids**: `broken-pattern-signals`, `broken-pattern-signal-{index}`

---

### components/timeline/TimelineList.tsx

**Props**:
```typescript
interface TimelineListProps {
  meetings: TimelineMeetingEntry[]
  activeTag: string | null
}
```

**Behavior**:
- Empty state if meetings.length === 0: "No meetings recorded yet. Add your first 1:1 to start tracking growth."
- Filtered empty state if activeTag and no matches: "No meetings tagged '[tag]'."
- List of `<TimelineEntry>` for each meeting

**data-testids**: `timeline-list`, `timeline-empty`, `timeline-filtered-empty`

---

### components/timeline/TimelineEntry.tsx

**Props**:
```typescript
interface TimelineEntryProps {
  meeting: TimelineMeetingEntry
}
```

**Layout**:
```
[Date] [Source icon (paste/upload/voice)]
[Summary text OR "Analysis in progress..." OR "Analysis failed."]
[Tag chips (if tags available)]
```

**data-testids**: `timeline-entry-{id}`, `timeline-entry-date-{id}`, `timeline-entry-summary-{id}`, `timeline-entry-tags-{id}`

---

### components/timeline/TagFilter.tsx

**Props**:
```typescript
interface TagFilterProps {
  availableTags: string[]
  activeTag: string | null
  onTagSelect: (tag: string | null) => void
}
```

**Layout**:
- "All" chip (selected when activeTag is null)
- One chip per available tag (sorted alphabetically)
- Clicking active tag deselects it (sets activeTag to null)

**data-testids**: `tag-filter`, `tag-filter-chip-{tag}`, `tag-filter-all`

---

### components/timeline/GrowthSummaryPanel.tsx

**Props**:
```typescript
interface GrowthSummaryPanelProps {
  summary: GrowthSummary | null
  isLoading: boolean
  onGenerate: () => void
}
```

**States**:
1. Not generated: show "Generate Growth Summary" button only
2. Loading: show spinner + "Generating summary…"
3. Error (summary = null after attempt): show "Growth summary unavailable. Try again later." + retry button
4. Loaded: show narrative, keyThemes, growthSignals, coachingGaps

**data-testids**: `growth-summary-panel`, `generate-summary-btn`, `summary-narrative`, `summary-themes`

---

## Modifications to Existing Components/Pages

### pages/teammates/[id]/index.tsx (minor modification)

Add tab navigation row below teammate name with links to:
- Profile (active on this page)
- Timeline → `/teammates/${id}/timeline`
- Commitments → `/teammates/${id}/commitments`
- Brief → `/teammates/${id}/brief`

Note: "Prepare for 1:1" button added in Unit 4 is removed from the header; "Brief" tab in the nav replaces it (cleaner UX).

**data-testid**: `teammate-tabs`, `tab-profile`, `tab-timeline`, `tab-commitments`, `tab-brief`

---

## API Integration Points

| Component | Endpoint | Method |
|-----------|----------|--------|
| CommitmentCard | /api/commitments/[id] | PATCH (done/carry/drop) |
| CommitmentCard | /api/commitments/[id] | DELETE |
| AddCommitmentModal | /api/commitments/[teammateId] | POST |
| commitments.tsx (load) | /api/commitments/[teammateId] | GET |
| timeline.tsx (load) | /api/timeline/[teammateId] | GET (+ ?tag= filter) |
| GrowthSummaryPanel | /api/timeline/[teammateId]/summary | POST |
