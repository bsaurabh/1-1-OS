# Frontend Components — Unit 2: Teammate Profiles

**Date**: 2026-03-01
**Unit**: Unit 2: Teammate Profiles
**Stories**: US-03, US-04

---

## Component Hierarchy

```
pages/index.tsx (Dashboard — enhanced from Unit 1)
  └── AppLayout
        └── TeammateList
              ├── TeammateCard (x N)
              └── AddTeammateModal (conditional)

pages/teammates/[id]/interview.tsx (NEW — Interview page)
  └── AppLayout
        └── InterviewChat
              ├── ConversationHistory (read-only messages)
              └── AnswerInput (textarea + submit)

pages/teammates/[id]/index.tsx (NEW — Profile page)
  └── AppLayout
        └── ProfileView
              ├── ProfileHeader (name, role, avatar placeholder)
              ├── ProfileIncompleteWarner (conditional banner)
              ├── ProfileFields (display or edit mode)
              │     └── ProfileFieldRow (x 7, one per area)
              └── ProfileEditControls (Save / Cancel buttons, edit mode only)
```

---

## Pages

---

### Page A: Dashboard (pages/index.tsx — enhanced)

**Purpose**: List all teammates; entry point for adding new ones.
**Auth**: Protected via `withAuth`.

**State**:
```typescript
interface DashboardState {
  teammates: TeammateListItem[]
  isLoading: boolean
  isAddModalOpen: boolean
  error: string | null
}
```

**Server-side data**: `getServerSideProps` via `withAuth` — calls `GET /api/teammates`, passes `{ teammates }` as props.

**User interactions**:
| Interaction | Behavior |
|-------------|----------|
| Page load | Teammate list rendered server-side (SSR) |
| Click "Add Teammate" | Opens `AddTeammateModal` |
| Click a TeammateCard | Navigates to `/teammates/[id]` |
| Modal submit success | Navigates to `/teammates/[id]/interview` |
| Modal cancel | Closes modal |

**API calls** (client-side):
- `POST /api/teammates` — triggered by `AddTeammateModal` submit

---

### Page B: Interview Page (pages/teammates/[id]/interview.tsx — NEW)

**Purpose**: Conduct the AI-led conversational interview for a newly created teammate.
**Auth**: Protected via `withAuth`.
**Route**: `/teammates/[id]/interview`

**Server-side data**: `getServerSideProps` fetches `GET /api/teammates/[id]` to confirm ownership and load `name`, `role`. Redirects to 404 if not found.

**State**:
```typescript
interface InterviewPageState {
  teammateName: string          // From SSR props
  role: string                  // From SSR props
  turns: ConversationTurn[]     // Accumulates completed Q&A (answered turns)
  currentQuestionIndex: number  // 1–7
  currentQuestion: string       // Text of the question Claude just asked
  currentArea: ProfileArea      // Area for current question
  currentAnswer: string         // Controlled textarea value
  isLoading: boolean            // True while waiting for Claude
  isComplete: boolean           // True after last answer submitted
  isSynthesizing: boolean       // True while POST /complete is in flight
  isFallback: boolean           // True if Claude error occurred
  error: string | null
}
```

**Lifecycle**:
1. On mount → call `POST /api/interviews/[id]/next` with empty history → receive question 1.
2. Manager types answer → updates `currentAnswer`.
3. Manager clicks "Submit" → append answered turn to `turns` → call `POST /api/interviews/[id]/next` with updated history.
4. If `isComplete: true` from server → call `POST /api/interviews/[id]/complete` → synthesize profile.
5. On success → redirect to `/teammates/[id]`.
6. On Claude error (503 + `fallback: true`) → redirect to `/teammates/[id]?editMode=1`.

**User interactions**:
| Interaction | Behavior |
|-------------|----------|
| Page mount | Auto-calls next-question endpoint to get Q1 |
| Type in answer field | Updates `currentAnswer` state |
| Click "Submit Answer" | Sends answer, loads next question |
| All 7 answered | Auto-triggers profile synthesis |
| Synthesis complete | Redirects to profile page |
| Claude error at any point | Shows fallback message, redirects to profile edit |

---

### Page C: Profile Page (pages/teammates/[id]/index.tsx — NEW)

**Purpose**: Display a teammate's full profile; supports inline section edit mode.
**Auth**: Protected via `withAuth`.
**Route**: `/teammates/[id]`

**Server-side data**: `getServerSideProps` via `withAuth` — calls `GET /api/teammates/[id]`, passes `{ teammate }` as props. Redirects to `/404` if not found.

**URL param**: `?editMode=1` activates edit mode on load (used by fallback redirect from interview).

**State**:
```typescript
interface ProfilePageState {
  teammate: TeammateDetailResponse  // From SSR props
  isEditMode: boolean               // Activates edit form for all fields
  editValues: {
    name: string
    role: string
    profile: Partial<ProfileFields>
  }
  isSaving: boolean
  saveError: string | null
  saveSuccess: boolean
}
```

**User interactions**:
| Interaction | Behavior |
|-------------|----------|
| Page load | Profile displayed; edit mode if `?editMode=1` |
| Click "Edit Profile" | Activates edit mode (all fields editable) |
| Edit any field | Updates `editValues` state |
| Click "Save" | Calls `PATCH /api/teammates/[id]`, shows toast |
| Click "Cancel" | Reverts `editValues` to original, exits edit mode |
| Click "Delete Teammate" | Shows confirmation dialog, calls `DELETE /api/teammates/[id]`, redirects to dashboard |
| Click "Start Interview" (if no profile) | Navigates to `/teammates/[id]/interview` |

---

## Components

---

### C1: TeammateList

**File**: `components/teammates/TeammateList.tsx`
**Purpose**: Renders the grid/list of teammate cards and the "Add Teammate" button.

**Props**:
```typescript
interface TeammateListProps {
  teammates: TeammateListItem[]
  onAddClick: () => void
}
```

**Renders**:
- "Add Teammate" button (primary, top-right).
- If `teammates.length === 0`: Empty state — "No teammates yet. Add your first direct report to get started."
- If `teammates.length > 0`: Grid of `TeammateCard` components.

---

### C2: TeammateCard

**File**: `components/teammates/TeammateCard.tsx`
**Purpose**: Compact card showing a teammate's name, role, and profile completeness indicator.

**Props**:
```typescript
interface TeammateCardProps {
  teammate: TeammateListItem
}
```

**Renders**:
- Avatar placeholder (initials from `name`).
- Name and role.
- Completeness badge: if `profileCompleteness < 5` show amber "Incomplete" badge; otherwise green "Profile complete".
- Click anywhere on card navigates to `/teammates/[teammate.id]`.

---

### C3: AddTeammateModal

**File**: `components/teammates/AddTeammateModal.tsx`
**Purpose**: Modal form for entering name and role before creating a teammate.

**Props**:
```typescript
interface AddTeammateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (teammateId: string) => void
}
```

**State**:
```typescript
interface AddTeammateModalState {
  name: string
  role: string
  isSubmitting: boolean
  errors: { name?: string; role?: string; general?: string }
}
```

**Validation** (client-side before API call):
- `name`: required, max 100 chars
- `role`: required, max 100 chars

**User interactions**:
| Interaction | Behavior |
|-------------|----------|
| Type in name field | Updates `name` state |
| Type in role field | Updates `role` state |
| Click "Start Profile Interview" | Validates fields → `POST /api/teammates` → `onSuccess(id)` |
| Click "Cancel" / backdrop | Calls `onClose()` |
| API error | Displays `errors.general` below form |

**On success**: `onSuccess(teammateId)` is called; parent navigates to `/teammates/[id]/interview`.

---

### C4: InterviewChat

**File**: `components/interview/InterviewChat.tsx`
**Purpose**: The conversational interview UI — shows the conversation history and the current question with an input.

**Props**:
```typescript
interface InterviewChatProps {
  teammateName: string
  turns: ConversationTurn[]          // Past Q&A (display only)
  currentQuestion: string            // Current question from Claude
  currentQuestionIndex: number       // 1–7
  currentArea: ProfileArea
  currentAnswer: string              // Controlled textarea value
  isLoading: boolean
  isComplete: boolean
  isSynthesizing: boolean
  onAnswerChange: (value: string) => void
  onSubmit: () => void
}
```

**Renders**:
- **Header**: "Building [teammateName]'s profile — Question [currentQuestionIndex] of 7"
- **Progress bar**: `currentQuestionIndex / 7` (e.g., 3/7 = 43%)
- **Conversation history**: Each past turn shown as:
  - AI bubble: Question text
  - User bubble: Answer text
- **Current question bubble**: Claude's latest question (AI bubble, no answer yet)
- **Answer input**: `<textarea>` with `placeholder="Type your answer..."`, min-height 80px, max 1000 chars
- **Submit button**: "Submit Answer" (disabled while `isLoading`)
- **Loading state**: Spinner replaces submit button while waiting for Claude
- **Synthesizing state**: "Building profile..." message shown when `isSynthesizing` is true

---

### C5: ProfileView

**File**: `components/teammates/ProfileView.tsx`
**Purpose**: Displays the teammate's full profile in view mode or edit mode.

**Props**:
```typescript
interface ProfileViewProps {
  teammate: TeammateDetailResponse
  isEditMode: boolean
  editValues: { name: string; role: string; profile: Partial<ProfileFields> }
  isSaving: boolean
  onEditStart: () => void
  onFieldChange: (field: string, value: string) => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}
```

**Renders**:

**View mode**:
- Profile header: name (h1), role (subtitle)
- "Edit Profile" button (top-right)
- "Delete Teammate" button (destructive, bottom or overflow menu)
- Completeness warning banner (if `profileCompleteness < 5`): "Profile incomplete — fill in more details to improve coaching suggestions."
- Profile fields grid (7 areas):
  - Each field: Label + value (or "Not yet filled in" in muted text if empty)
- If no profile at all (profile is null) and no interview done: "Start Interview" button

**Edit mode**:
- All fields become editable `<textarea>` elements
- `name` and `role` become `<input type="text">` at the top
- "Save" button (primary)
- "Cancel" button (secondary)
- In-line validation errors shown beneath each field

---

### C6: ProfileIncompleteWarner

**File**: Inline in `ProfileView` (not a separate file)
**Purpose**: Banner shown when `profileCompleteness < 5`.

**Renders**:
```
[!] Profile incomplete — fill in more details to improve coaching suggestions.
    [Edit Profile →]
```

---

## User Interaction Flows

### Flow A: Add Teammate + Complete Interview

```
1. Dashboard: Click "Add Teammate"
   → AddTeammateModal opens

2. Modal: Enter name "Chirag", role "Senior Product Designer"
   → Click "Start Profile Interview"
   → POST /api/teammates
   → Navigate to /teammates/[id]/interview

3. Interview page mounts
   → POST /api/interviews/[id]/next (history: [])
   → Claude Haiku returns Q1: "What are Chirag's key strengths?"

4. Manager types answer → "He's really strong at systems thinking..."
   → Click "Submit Answer"
   → POST /api/interviews/[id]/next (history: [{Q1, A1}])
   → Claude Haiku returns Q2 (with brief acknowledgment + next question)

5. Repeat for Q2–Q6

6. Manager submits Q7 answer
   → POST /api/interviews/[id]/next (history: [{Q1,A1}...{Q7,A7}])
   → Server returns { isComplete: true }
   → Frontend shows "Building profile..."
   → POST /api/interviews/[id]/complete
   → Claude Sonnet synthesizes profile
   → Profile saved to DB
   → Navigate to /teammates/[id]

7. Profile page shows completed profile
   → No incomplete banner (all 7 + role = 8 fields populated)
```

### Flow B: Claude Unavailable (Fallback)

```
1-2. Same as Flow A (modal, create teammate)

3. Interview page mounts
   → POST /api/interviews/[id]/next
   → Claude API error → 503 { fallback: true }

4. Frontend shows: "AI interview unavailable. You can fill in the profile manually."
   → Navigate to /teammates/[id]?editMode=1

5. Profile page opens in edit mode with all fields empty
   → Manager fills in fields manually
   → Click "Save"
   → PATCH /api/teammates/[id]
   → Toast: "Profile saved."
```

### Flow C: Edit Existing Profile (US-04)

```
1. Navigate to /teammates/[id]
   → Profile displayed in view mode

2. Click "Edit Profile"
   → Edit mode activates (all fields become inputs/textareas)
   → All existing values pre-populated in edit fields

3. Manager edits "Strengths" and "Growth Areas"
   → Click "Save"
   → PATCH /api/teammates/[id] { profile: { strengths: "...", growthAreas: "..." } }
   → Server merges into existing profile JSONB
   → Toast: "Profile saved."
   → Edit mode deactivates

4. Click "Cancel" without saving
   → Edit values reset to original
   → Edit mode deactivates
```

### Flow D: Delete Teammate

```
1. On /teammates/[id], click "Delete Teammate"
   → Confirmation dialog: "Delete Chirag? This will remove all meetings, patterns, and commitments. This cannot be undone."

2. Click "Confirm Delete"
   → DELETE /api/teammates/[id]
   → Cascade deletes all related data
   → Navigate to dashboard (/)
```

---

## Form Validation Matrix

| Field | Required | Min Length | Max Length | Validation Error |
|-------|----------|------------|------------|------------------|
| name (create/edit) | Yes | 1 | 100 | "Name is required" / "Name must be under 100 characters" |
| role (create/edit) | Yes | 1 | 100 | "Role is required" / "Role must be under 100 characters" |
| strengths (edit) | No | — | — | No validation (optional free text) |
| growthAreas (edit) | No | — | — | No validation |
| aspirations (edit) | No | — | — | No validation |
| kpis (edit) | No | — | — | No validation |
| behavioralTendencies (edit) | No | — | — | No validation |
| feedbackStyle (edit) | No | — | — | No validation |
| motivationDrivers (edit) | No | — | — | No validation |
| Interview answer | No | — | 1000 | Max length warning (soft) |

---

## API Endpoints Consumed by Frontend

| Component / Page | API Call | When |
|-----------------|----------|------|
| Dashboard (SSR) | `GET /api/teammates` | `getServerSideProps` |
| AddTeammateModal | `POST /api/teammates` | On form submit |
| InterviewChat (mount) | `POST /api/interviews/[id]/next` (empty history) | On page mount |
| InterviewChat (each answer) | `POST /api/interviews/[id]/next` | On "Submit Answer" click |
| InterviewChat (complete) | `POST /api/interviews/[id]/complete` | After `isComplete: true` |
| ProfileView (SSR) | `GET /api/teammates/[id]` | `getServerSideProps` |
| ProfileView (save) | `PATCH /api/teammates/[id]` | On "Save" click |
| ProfileView (delete) | `DELETE /api/teammates/[id]` | On confirm delete |

---

## data-testid Attributes (for E2E Testing)

| Element | data-testid |
|---------|-------------|
| "Add Teammate" button | `add-teammate-button` |
| Modal name input | `teammate-name-input` |
| Modal role input | `teammate-role-input` |
| Modal submit button | `start-interview-button` |
| Current interview question | `interview-question` |
| Answer textarea | `interview-answer-input` |
| Submit answer button | `submit-answer-button` |
| Interview progress bar | `interview-progress` |
| "Building profile..." state | `synthesizing-message` |
| Profile incomplete banner | `profile-incomplete-banner` |
| "Edit Profile" button | `edit-profile-button` |
| Profile field (by area key) | `profile-field-{area}` (e.g., `profile-field-strengths`) |
| Profile save button | `profile-save-button` |
| Profile cancel button | `profile-cancel-button` |
| Delete teammate button | `delete-teammate-button` |
| Delete confirm button | `confirm-delete-button` |
| TeammateCard | `teammate-card-{id}` |
| Fallback message | `interview-fallback-message` |
