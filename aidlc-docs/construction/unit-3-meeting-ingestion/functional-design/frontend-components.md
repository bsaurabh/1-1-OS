# Frontend Components — Unit 3: Meeting Ingestion

**Date**: 2026-03-02
**Unit**: Unit 3: Meeting Ingestion

---

## Component Hierarchy

```
pages/teammates/[id]/index.tsx          ← Modified (Unit 3 adds meeting ingestion)
  └── MeetingInputModal                 ← NEW — tab switcher for 3 ingestion methods
        ├── PasteInput                  ← NEW — paste notes tab
        ├── FileUpload                  ← NEW — upload transcript tab
        └── VoiceRecorder               ← NEW — voice recording tab
              └── TranscriptionReview   ← NEW — editable transcription review

pages/teammates/[id]/meeting/[meetingId].tsx  ← NEW — analysis results page
  ├── MeetingAnalysisResults            ← NEW — themes, tags, tone, summary
  └── SuggestedCommitments             ← NEW — commit confirm/dismiss/edit UI

components/shared/AnalysisPendingBanner ← NEW — "notes saved, analysis in progress"
```

---

## Page: `pages/teammates/[id]/meeting/[meetingId].tsx`

**Purpose**: Displays analysis results for a completed meeting; also shows pending state with a polling refresh.

**Props / Server State** (via `getServerSideProps` + `withAuth`):
```typescript
interface MeetingPageProps {
  managerEmail: string
  teammate:     TeammateDetail
  meeting: {
    id:        string
    source:    MeetingSource
    status:    AnalysisStatus
    themes:    Theme[] | null
    tags:      string[]
    summary:   string | null
    tone:      string | null
    rawText:   string
    createdAt: string
  }
  commitments: SuggestedCommitmentItem[]  // status=SUGGESTED commitments
}
```

**State** (client-side):
- `commitments: SuggestedCommitmentItem[]` — mutable list for confirm/dismiss

**Behaviour**:
- If `meeting.status === PENDING_ANALYSIS`: show `<AnalysisPendingBanner>` + auto-refresh every 5s (polling `GET /api/meetings/[teammateId]/[meetingId]`) until status changes
- If `meeting.status === ANALYSIS_COMPLETE`: show `<MeetingAnalysisResults>` + `<SuggestedCommitments>`
- If `meeting.status === ANALYSIS_FAILED`: show error banner with "Analysis failed — your notes are saved. Add commitments manually."

---

## Component: `MeetingInputModal`

**File**: `components/meetings/MeetingInputModal.tsx`

**Purpose**: Modal with three tabs — Paste / Upload / Record. Manages which ingestion method is active and handles navigation to the meeting results page on success.

**Props**:
```typescript
interface MeetingInputModalProps {
  isOpen:       boolean
  teammateName: string
  teammateId:   string
  onClose:      () => void
  onSuccess:    (meetingId: string) => void
}
```

**State**:
```typescript
type TabId = 'paste' | 'upload' | 'record'
activeTab: TabId = 'paste'
```

**Behaviour**:
- Renders three tab buttons: "Paste Notes" / "Upload File" / "Record Voice"
- Renders the active tab's child component (`PasteInput`, `FileUpload`, or `VoiceRecorder`)
- On child success: calls `onSuccess(meetingId)` → parent navigates to `/teammates/[id]/meeting/[meetingId]`
- On close: calls `onClose()`; does NOT reset child state while modal is open (prevents data loss)

**data-testid**: `meeting-modal`, `tab-paste`, `tab-upload`, `tab-record`

---

## Component: `PasteInput`

**File**: `components/meetings/PasteInput.tsx`

**Purpose**: Textarea for pasting meeting notes with character count and submit.

**Props**:
```typescript
interface PasteInputProps {
  teammateId: string
  onSuccess:  (meetingId: string) => void
}
```

**State**:
```typescript
text:      string = ''
isLoading: boolean = false
error:     string | null = null
```

**Behaviour**:
- Textarea: placeholder "Paste your 1:1 notes here…", no max length (server enforces min)
- Character count displayed below textarea: `{text.length} characters` (turns red when < 50)
- "Analyze" button: disabled when `text.trim().length < 50` OR `isLoading`
- On submit: `POST /api/meetings/[teammateId]/paste` with `{ text }`
  - 400 → set `error` from response body
  - 200 → call `onSuccess(data.meetingId)`
- Loading state: "Analyzing…" with spinner (button text changes)

**Validation**: Button disabled below 50 chars. Server also validates (belt-and-suspenders).

**data-testid**: `paste-textarea`, `paste-char-count`, `paste-submit-button`, `paste-error`

---

## Component: `FileUpload`

**File**: `components/meetings/FileUpload.tsx`

**Purpose**: Drag-and-drop or click-to-select file upload for .txt, .docx, .pdf transcripts.

**Props**:
```typescript
interface FileUploadProps {
  teammateId: string
  onSuccess:  (meetingId: string) => void
}
```

**State**:
```typescript
selectedFile: File | null = null
isLoading:    boolean = false
error:        string | null = null
isDragging:   boolean = false
```

**Behaviour**:
- Drop zone: shows file name when selected; displays "Drag & drop or click to select" when empty
- Accept attribute: `.txt,.docx,.pdf` (HTML file input `accept` attribute)
- File validation (client-side pre-check):
  - Extension not .txt/.docx/.pdf → set error immediately, do not send
  - `file.size > 10 * 1024 * 1024` → set error immediately
- "Upload & Analyze" button: disabled when no file selected OR `isLoading`
- On submit: `POST /api/meetings/[teammateId]/upload` as `multipart/form-data` with `file` field
  - 400/422 → set `error`
  - 200 → call `onSuccess(data.meetingId)`

**data-testid**: `file-drop-zone`, `file-input`, `file-name-display`, `upload-submit-button`, `file-upload-error`

---

## Component: `VoiceRecorder`

**File**: `components/meetings/VoiceRecorder.tsx`

**Purpose**: Browser-based voice recorder using `MediaRecorder` API. Manages the full recording → upload → transcribe → review lifecycle.

**Props**:
```typescript
interface VoiceRecorderProps {
  managerId:  string
  teammateId: string
  onSuccess:  (meetingId: string) => void
  onDiscard:  () => void
}
```

**State machine**:
```typescript
type RecorderState =
  | 'IDLE'           // Ready to start recording
  | 'REQUESTING'     // Awaiting microphone permission
  | 'RECORDING'      // MediaRecorder active, timer running
  | 'UPLOADING'      // Audio blob being sent to Supabase Storage
  | 'TRANSCRIBING'   // Whisper API in progress
  | 'REVIEW'         // Transcription ready; editing allowed
  | 'ERROR'          // Non-recoverable error
```

**State**:
```typescript
recorderState: RecorderState = 'IDLE'
elapsedSeconds: number = 0
fileId:         string | null = null
transcription:  string = ''
error:          string | null = null
```

**Behaviour by state**:

`IDLE`:
- Shows large microphone button with "Record Voice Summary" label
- Click → `REQUESTING`

`REQUESTING`:
- Calls `navigator.mediaDevices.getUserMedia({ audio: true })`
- On permission granted → create `MediaRecorder`, transition to `RECORDING`
- On permission denied → `ERROR` with "Microphone access required. Please allow microphone in your browser settings."

`RECORDING`:
- Shows recording indicator (pulsing red dot), elapsed timer `mm:ss`
- "Stop Recording" button → stops `MediaRecorder`, collects audio chunks
- `GET /api/transcription/start` to get `{ uploadUrl, fileId }` → `UPLOADING`

`UPLOADING`:
- `PUT audioBlob` to `uploadUrl` (direct to Supabase Storage)
- On success → `POST /api/transcription/transcribe` with `{ fileId }` → `TRANSCRIBING`
- On failure → `ERROR` with "Upload failed. Please try again."

`TRANSCRIBING`:
- Shows "Transcribing your recording…" with spinner
- On success → set `transcription = data.text`, `fileId = data.fileId` → `REVIEW`
- On failure → `ERROR` with "Transcription failed. Please paste your notes manually or try again."

`REVIEW`:
- Renders `<TranscriptionReview transcription={transcription} fileId={fileId} ... />`

`ERROR`:
- Shows error message and "Try Again" button (resets to `IDLE`)

**data-testid**: `record-button`, `stop-button`, `recording-timer`, `transcribing-spinner`, `recorder-error`

---

## Component: `TranscriptionReview`

**File**: `components/meetings/TranscriptionReview.tsx`

**Purpose**: Editable textarea showing the transcription. "Save & Analyze" submits as a meeting; "Discard" deletes the audio and transcription.

**Props**:
```typescript
interface TranscriptionReviewProps {
  teammateName:  string
  teammateId:    string
  fileId:        string
  initialText:   string
  onSaved:       (meetingId: string) => void
  onDiscarded:   () => void
}
```

**State**:
```typescript
text:      string = initialText
isLoading: boolean = false
error:     string | null = null
```

**Behaviour**:
- Textarea pre-filled with `initialText` (from Whisper); manager can edit freely
- Character count displayed (same as PasteInput style)
- **"Save & Analyze"** button:
  - `POST /api/meetings/[teammateId]/save-transcription` with `{ text }`
  - On 200 → call `onSaved(data.meetingId)`
  - On error → set `error`
- **"Discard"** button (secondary, outlined):
  - `DELETE /api/transcription/[fileId]`
  - Regardless of response → call `onDiscarded()`

**data-testid**: `transcription-textarea`, `save-analyze-button`, `discard-button`, `transcription-error`

---

## Component: `MeetingAnalysisResults`

**File**: `components/meetings/MeetingAnalysisResults.tsx`

**Purpose**: Displays the AI analysis output — themes, tags, tone, summary.

**Props**:
```typescript
interface MeetingAnalysisResultsProps {
  themes:  Theme[]
  tags:    string[]
  tone:    string
  summary: string
  source:  MeetingSource
  date:    string   // ISO string, formatted for display
}
```

**Behaviour**:
- **Summary**: single prominent sentence at top
- **Tone**: displayed as a badge/pill (e.g., "Constructive")
- **Tags**: row of category tag chips (e.g., `growth`, `delivery`)
- **Themes**: numbered list, each with `title` (bold) + `description`
- **Source indicator**: small label showing how meeting was captured ("Pasted notes" / "Uploaded file" / "Voice recording")

**data-testid**: `analysis-summary`, `analysis-tone`, `analysis-tags`, `analysis-themes`, `theme-item-{n}`

---

## Component: `SuggestedCommitments`

**File**: `components/commitments/SuggestedCommitments.tsx`

**Purpose**: Review panel for AI-extracted commitment suggestions — confirm, edit, or dismiss each one.

**Props**:
```typescript
interface SuggestedCommitmentsProps {
  meetingId:   string
  commitments: SuggestedCommitmentItem[]
  onChange:    (updated: SuggestedCommitmentItem[]) => void
}

interface SuggestedCommitmentItem {
  id:    string
  text:  string
  owner: 'MANAGER' | 'TEAMMATE'
}
```

**State** (per commitment item, managed in parent via `onChange`):
```typescript
editingId: string | null = null
editText:  string = ''
```

**Behaviour per commitment item**:
- Shows commitment text + owner badge ("Manager" / "Teammate")
- **"Confirm"** button: `PATCH /api/commitments/[id]` with `{ action: 'confirm' }` → remove from list via `onChange`
- **"Edit"** button: opens inline edit field pre-filled with `text`; shows "Save" button; `PATCH /api/commitments/[id]` with `{ action: 'confirm', text: editedText }` → remove from list
- **"Dismiss"** button: `PATCH /api/commitments/[id]` with `{ action: 'dismiss' }` → remove from list via `onChange`
- If no commitments remain: show "All commitments reviewed." message

**Empty state** (no commitments extracted): component not rendered (parent checks for non-empty list)

**data-testid**: `suggested-commitments-section`, `commitment-item-{id}`, `confirm-commitment-{id}`, `edit-commitment-{id}`, `dismiss-commitment-{id}`

---

## Component: `AnalysisPendingBanner`

**File**: `components/meetings/AnalysisPendingBanner.tsx`

**Purpose**: Shown while `meeting.status === PENDING_ANALYSIS`. Reassures manager notes are saved and analysis is underway.

**Props**:
```typescript
interface AnalysisPendingBannerProps {
  onRefresh: () => void   // Called by parent's polling interval
}
```

**Behaviour**:
- Amber banner: "Analysis in progress — your notes are saved. This usually takes under 30 seconds."
- Spinner indicator
- No user action required; parent page polls automatically

**data-testid**: `analysis-pending-banner`

---

## Modified Page: `pages/teammates/[id]/index.tsx`

**Changes from Unit 2**: Add "Add Meeting" button → opens `<MeetingInputModal>`. On `onSuccess`, navigate to `/teammates/[id]/meeting/[meetingId]`.

**New state**:
```typescript
isMeetingModalOpen: boolean = false
```

**New handler**:
```typescript
function handleMeetingSuccess(meetingId: string) {
  setMeetingModalOpen(false)
  router.push(`/teammates/${teammateId}/meeting/${meetingId}`)
}
```

**data-testid**: `add-meeting-button`

---

## API Integration Summary

| Component | Endpoint | Method | Purpose |
|-----------|----------|--------|---------|
| PasteInput | `/api/meetings/[id]/paste` | POST | Submit pasted notes |
| FileUpload | `/api/meetings/[id]/upload` | POST (multipart) | Upload document |
| VoiceRecorder | `/api/transcription/start` | GET | Get presigned upload URL |
| VoiceRecorder | `/api/transcription/transcribe` | POST | Trigger Whisper transcription |
| TranscriptionReview | `/api/meetings/[id]/save-transcription` | POST | Save reviewed transcription |
| TranscriptionReview | `/api/transcription/[fileId]` | DELETE | Discard audio + transcription |
| MeetingPage | `/api/meetings/[id]/[meetingId]` | GET | Poll for analysis status |
| SuggestedCommitments | `/api/commitments/[commitmentId]` | PATCH | Confirm / dismiss suggestion |
| (AppLayout / settings) | `/api/notifications/subscribe` | POST | Register push subscription |
| (AppLayout / settings) | `/api/notifications/subscribe` | DELETE | Remove push subscription |
