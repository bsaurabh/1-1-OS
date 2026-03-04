# User Stories — 1:1OS

**Format**: BDD (Given / When / Then)
**AI Output Criteria**: Structure + fallback behavior
**Persona**: Design Manager
**Total Stories**: 17
**Organization**: Feature-Based Epics

---

## Epic 1: Authentication & Account Setup (FR-01)

---

### US-01: Sign up for an account

**As a** Design Manager,
**I want to** create an account using my email and password,
**So that** I can securely access my private 1:1 coaching workspace.

**Acceptance Criteria**:

**Scenario: Successful sign up**
- Given I am on the sign-up page
- When I enter a valid email address, a password of at least 8 characters, and submit the form
- Then my account is created and I am redirected to the onboarding flow

**Scenario: Duplicate email**
- Given I enter an email address already registered in the system
- When I submit the sign-up form
- Then I see an error message: "An account with this email already exists. Please log in."

**Scenario: Weak password**
- Given I enter a password shorter than 8 characters
- When I submit the sign-up form
- Then I see a validation error before submission: "Password must be at least 8 characters."

---

### US-02: Log in and log out

**As a** Design Manager,
**I want to** log in with my email and password and securely log out,
**So that** only I can access my teammates' coaching data.

**Acceptance Criteria**:

**Scenario: Successful login**
- Given I have a registered account
- When I enter my correct email and password
- Then I am authenticated and redirected to my manager dashboard

**Scenario: Wrong credentials**
- Given I enter an incorrect email or password
- When I submit the login form
- Then I see: "Incorrect email or password." and remain on the login page

**Scenario: Session expiry**
- Given I have been inactive for 24 hours
- When I attempt to navigate to any authenticated page
- Then I am redirected to the login page with a message: "Your session has expired. Please log in again."

**Scenario: Logout**
- Given I am logged in
- When I click "Log out"
- Then my session is terminated and I am redirected to the login page

### US-16: Reset a forgotten password

**As a** Design Manager,
**I want to** request a password reset link when I forget my password,
**So that** I can regain access to my account without losing my data.

**Acceptance Criteria**:

**Scenario: Requesting a reset link**
- Given I am on the login page and click "Forgot password?"
- When I enter my registered email address and submit
- Then I see: "If an account exists for this email, a reset link has been sent." regardless of whether the email exists (to prevent email enumeration)

**Scenario: Using a valid reset link**
- Given I click the reset link in my email (valid for 1 hour)
- When I enter and confirm a new password of at least 8 characters
- Then my password is updated and I am redirected to the login page with: "Password updated. Please log in."

**Scenario: Expired reset link**
- Given I click a reset link older than 1 hour
- When the page loads
- Then I see: "This link has expired. Please request a new one." with a link back to the forgot password page

**Scenario: Reset link already used**
- Given a reset link has already been used
- When someone attempts to use the same link again
- Then I see: "This link is no longer valid. Please request a new one."

---

## Epic 2: Teammate Profile Setup (FR-02)

---

### US-03: Add a new teammate and start the AI onboarding interview

**As a** Design Manager,
**I want to** add a new direct report and have the AI interview me about them,
**So that** a structured profile is built from my knowledge without filling out a form.

**Acceptance Criteria**:

**Scenario: Starting the onboarding interview**
- Given I click "Add Teammate" and enter the teammate's name and role
- When I click "Start Profile Interview"
- Then the AI presents the first interview question in a conversational interface

**Scenario: Interview question flow**
- Given I am in the onboarding interview
- When I answer each AI question in natural language and press submit
- Then the AI acknowledges my answer and presents the next relevant question until all profile areas are covered (role, strengths, growth areas, aspirations, KPIs, behavioral tendencies, feedback style, motivation drivers)

**Scenario: AI profile generation**
- Given I have completed all interview questions
- When the interview ends
- Then the AI generates and displays a structured profile card with all fields populated from my answers

**Scenario: Fallback — AI interview fails**
- Given the AI service is unavailable during the interview
- When I attempt to start or continue the interview
- Then I see: "AI interview unavailable. You can fill in the profile manually." and a manual form is presented

---

### US-04: Review and edit a teammate's profile

**As a** Design Manager,
**I want to** review the AI-generated profile and make manual edits,
**So that** the profile accurately reflects my knowledge of this person.

**Acceptance Criteria**:

**Scenario: Editing a profile field**
- Given I am on a teammate's profile page
- When I click on any profile field (e.g., Strengths, Growth Areas)
- Then the field becomes editable inline and I can type my changes

**Scenario: Saving edits**
- Given I have edited one or more profile fields
- When I click "Save"
- Then the changes are persisted and a success confirmation is shown

**Scenario: Empty profile warning**
- Given a teammate profile has fewer than 5 fields populated
- When I view the teammate's dashboard
- Then a banner is shown: "Profile incomplete — fill in more details to improve coaching suggestions."

---

## Epic 3: Meeting Ingestion (FR-03)

---

### US-05: Paste a meeting summary

**As a** Design Manager,
**I want to** paste my notes from a 1:1 into the app,
**So that** the AI can extract themes and update the teammate's coaching model.

**Acceptance Criteria**:

**Scenario: Submitting a pasted summary**
- Given I am on a teammate's page and click "Add Meeting"
- When I select "Paste Notes", type or paste text of at least 50 characters, and click "Analyze"
- Then the AI processes the text and displays extracted themes, emotional tone, and category tags

**Scenario: Text too short**
- Given I enter fewer than 50 characters in the paste field
- When I click "Analyze"
- Then I see: "Please add more detail — at least 50 characters required for meaningful analysis."

**Scenario: AI extracts commitments from pasted notes**
- Given the AI successfully analyzes the pasted summary
- When the analysis completes
- Then any detected commitment statements (e.g., "I will...", "Chirag will...") are surfaced as suggested commitments for review alongside the extracted themes

**Scenario: AI extraction fallback**
- Given the AI service fails during analysis
- When I submit the summary
- Then the raw summary is saved with a status of "Pending analysis" and I see: "Analysis will retry automatically. Your notes are saved."

---

### US-06: Upload a meeting transcript file

**As a** Design Manager,
**I want to** upload a .txt, .docx, or .pdf transcript of my 1:1,
**So that** I don't have to manually re-type the conversation.

**Acceptance Criteria**:

**Scenario: Successful file upload**
- Given I select "Upload Transcript" and choose a .txt, .docx, or .pdf file under 10MB
- When I click "Upload & Analyze"
- Then the file is parsed, text is extracted, and the AI processes it as a meeting summary

**Scenario: Unsupported file type**
- Given I select a file with an unsupported extension (e.g., .mp3, .xlsx)
- When I attempt to upload
- Then I see: "Only .txt, .docx, and .pdf files are supported."

**Scenario: File too large**
- Given I select a file larger than 10MB
- When I attempt to upload
- Then I see: "File size exceeds 10MB limit. Please upload a smaller file."

**Scenario: AI extracts commitments from uploaded transcript**
- Given the AI successfully processes an uploaded transcript
- When analysis completes
- Then any detected commitment statements in the transcript are surfaced as suggested commitments for review alongside the extracted themes

---

### US-07: Record a voice meeting summary and have it transcribed

**As a** Design Manager,
**I want to** record a voice summary directly in the browser after my 1:1,
**So that** I can capture context naturally without typing.

**Acceptance Criteria**:

**Scenario: Starting a recording**
- Given I select "Record Voice Summary" for a teammate
- When I click the microphone button
- Then the browser requests microphone permission and recording begins, with a live timer visible

**Scenario: Stopping and submitting a recording**
- Given I am recording
- When I click "Stop Recording"
- Then recording stops and the audio is sent for transcription automatically

**Scenario: Transcription complete**
- Given my recording has been submitted
- When transcription is complete (within 60 seconds for recordings under 60 minutes)
- Then the transcribed text is displayed in an editable review field

**Scenario: Transcription failure fallback**
- Given the transcription service is unavailable
- When I submit a recording
- Then I see: "Transcription failed. Please paste your notes manually or try again." and my recording session ends without data loss

---

### US-08: Review and edit a transcription before saving

**As a** Design Manager,
**I want to** review and correct the transcribed text before it is saved,
**So that** inaccuracies from speech-to-text do not corrupt the coaching data.

**Acceptance Criteria**:

**Scenario: Editing transcription**
- Given a transcription is displayed in the review field
- When I click on any part of the text and make changes
- Then the changes are reflected in the editable field in real time

**Scenario: Confirming and saving**
- Given I have reviewed (and optionally edited) the transcription
- When I click "Save & Analyze"
- Then the final text is sent to the AI for theme extraction and the audio file is deleted from storage

**Scenario: Discarding a transcription**
- Given a transcription is displayed
- When I click "Discard"
- Then the transcription and original audio are deleted and I am returned to the teammate's page

---

### US-17: Review and confirm AI-extracted commitments from a meeting

**As a** Design Manager,
**I want to** see commitments the AI detected in my meeting notes, transcript, or voice recording and confirm which ones to save,
**So that** commitments are captured automatically without me having to type them out manually.

**Acceptance Criteria**:

**Scenario: Commitments detected — review presented**
- Given the AI analysis of a meeting identified one or more commitment statements
- When the analysis results are displayed
- Then a "Suggested Commitments" section is shown with each detected commitment listed, attributed to either Manager or Teammate based on context (e.g., "I will..." → Manager, "Chirag will..." → Teammate)

**Scenario: Confirming a suggested commitment**
- Given a suggested commitment is displayed
- When I click "Confirm"
- Then the commitment is saved with status "Open" and attributed to the correct party, and it appears in the teammate's commitment list

**Scenario: Dismissing a suggested commitment**
- Given a suggested commitment is displayed
- When I click "Dismiss"
- Then the commitment is discarded and does not appear in the commitment tracker

**Scenario: Editing a suggested commitment before confirming**
- Given a suggested commitment is displayed
- When I click "Edit" and modify the commitment text before confirming
- Then the edited version is saved, not the original AI-extracted text

**Scenario: No commitments detected**
- Given the AI analyzes meeting content but finds no commitment statements
- When the analysis results are displayed
- Then the "Suggested Commitments" section is not shown, and I can still add commitments manually

**Scenario: AI commitment extraction fallback**
- Given the AI fails to analyze for commitments
- When the meeting analysis completes
- Then themes and tags are still displayed, and a note reads: "Commitment extraction unavailable — add commitments manually if needed."

---

## Epic 4: Pattern Intelligence (FR-04)

---

### US-09: View detected patterns for a teammate

**As a** Design Manager,
**I want to** see recurring patterns detected across all of a teammate's 1:1s,
**So that** I am aware of issues or trends I may have missed in individual sessions.

**Acceptance Criteria**:

**Scenario: Patterns available**
- Given a teammate has at least 2 ingested meetings
- When I view the teammate's "Patterns" section
- Then I see a list of detected patterns, each with: description, supporting meeting dates, and severity (Informational / Watch / Action Required)

**Scenario: No patterns yet**
- Given a teammate has fewer than 2 ingested meetings
- When I view the Patterns section
- Then I see: "Not enough meeting data yet. Patterns will appear after 2 or more meetings are recorded."

**Scenario: AI pattern detection fallback**
- Given the AI fails to analyze a new meeting for patterns
- When a meeting is ingested
- Then the meeting is saved, the Patterns section shows a banner: "Pattern analysis pending — will update shortly." and a retry is queued

---

## Epic 5: Pre-Meeting Brief Generator (FR-05)

---

### US-10: Generate a pre-meeting brief for a teammate

**As a** Design Manager,
**I want to** click "Prepare" before a 1:1 and receive an AI-generated brief,
**So that** I enter the meeting with context, focus, and sharp questions ready.

**Acceptance Criteria**:

**Scenario: Successful brief generation**
- Given I click "Prepare" on a teammate's page
- When the AI generates the brief (within 10 seconds)
- Then I see a structured brief containing all of the following sections:
  - Context summary (last meeting recap + open threads)
  - Open commitments from the previous 1:1
  - Active pattern signals
  - Suggested coaching focus
  - Risk signals (if any)
  - 5–7 tailored follow-up questions
  - One "uncomfortable but important" question

**Scenario: AI brief generation fallback**
- Given the AI service is unavailable when I click "Prepare"
- When the brief cannot be generated
- Then I see: "Brief generation failed. Here is a summary of open commitments and last meeting notes to help you prepare." and the raw data is displayed as a fallback

**Scenario: No meeting history**
- Given a teammate has no ingested meetings
- When I click "Prepare"
- Then I see: "No meeting history yet. Complete at least one meeting to generate a brief." with a prompt to add a meeting

---

### US-11: Regenerate or copy the pre-meeting brief

**As a** Design Manager,
**I want to** regenerate the brief if it misses something or copy it to use elsewhere,
**So that** I have flexibility in how I use the coaching output.

**Acceptance Criteria**:

**Scenario: Regenerating the brief**
- Given a brief has been generated
- When I click "Regenerate Brief"
- Then a new brief is generated using the same data, and the previous brief is replaced

**Scenario: Copying the brief**
- Given a brief is displayed
- When I click "Copy to Clipboard"
- Then the full brief text is copied to the clipboard and a confirmation toast appears: "Brief copied."

---

## Epic 6: Coaching Strategy Layer (FR-06)

---

### US-12: View the AI-selected coaching framework and rationale

**As a** Design Manager,
**I want to** see which coaching framework the AI recommends for this teammate's current situation and why it was chosen,
**So that** I have a structured angle for the conversation, not just questions.

**Acceptance Criteria**:

**Scenario: Framework recommended**
- Given a pre-meeting brief is generated and the AI has sufficient context
- When the brief is displayed
- Then I see a "Coaching Approach" section containing: the framework name, a 2–3 sentence explanation of why this framework fits this individual right now, and 1–2 specific coaching actions suggested by the framework

**Scenario: AI framework selection fallback**
- Given the AI cannot confidently determine a framework (insufficient context or service failure)
- When the brief is displayed
- Then the "Coaching Approach" section shows: "Not enough context to recommend a specific framework. Consider asking open-ended questions about what's going well and what feels hard right now."

---

## Epic 7: Growth Timeline (FR-07)

---

### US-13: View a teammate's meeting history with tags and filter by category

**As a** Design Manager,
**I want to** see a chronological list of all 1:1 summaries for a teammate with their category tags,
**So that** I can quickly scan growth, blockers, and recurring themes over time.

**Acceptance Criteria**:

**Scenario: Viewing the timeline**
- Given a teammate has at least one ingested meeting
- When I navigate to their "Growth Timeline" tab
- Then I see a reverse-chronological list of meetings, each showing: date, AI-generated one-line summary, and category tags (Growth, Blocker, Motivation, Skill Gap, Conflict, Win, Accountability, Other)

**Scenario: Filtering by tag**
- Given the timeline is displayed
- When I select a tag filter (e.g., "Blocker")
- Then only meetings tagged with "Blocker" are shown and the count of matching meetings is displayed

**Scenario: Empty timeline**
- Given a teammate has no ingested meetings
- When I navigate to the Growth Timeline
- Then I see: "No meetings recorded yet. Add your first 1:1 to start tracking growth."

---

## Epic 8: Action & Commitment Tracker (FR-08)

---

### US-14: Manually add a commitment after a 1:1

**As a** Design Manager,
**I want to** manually record a commitment that wasn't captured by the AI extraction,
**So that** I can add anything the AI missed or that came up outside of the meeting notes.

**Acceptance Criteria**:

**Scenario: Adding a manager commitment**
- Given I am on a teammate's page after a meeting
- When I click "Add Commitment", select "Manager Commitment", type the commitment text, and optionally set a due date
- Then the commitment is saved and appears in the teammate's open commitments list with status "Open"

**Scenario: Adding a teammate commitment**
- Given I click "Add Commitment" and select "Teammate Commitment"
- When I enter the commitment text and click Save
- Then the commitment is saved and attributed to the teammate with status "Open"

**Scenario: Duplicate detection**
- Given an identical commitment text already exists as "Open" for this teammate
- When I attempt to save the same text
- Then I see: "A similar open commitment already exists. Do you want to add another or update the existing one?"

---

### US-15: Review open commitments and mark them as resolved

**As a** Design Manager,
**I want to** review all open commitments for a teammate and mark each as Done, Carried Forward, or Dropped,
**So that** I maintain an accurate accountability record and the next brief reflects reality.

**Acceptance Criteria**:

**Scenario: Marking a commitment as Done**
- Given a commitment has status "Open"
- When I click "Mark Done"
- Then the commitment status changes to "Done" with the current date and it no longer appears in the Pre-Meeting Brief

**Scenario: Carrying a commitment forward**
- Given a commitment remains unresolved
- When I click "Carry Forward"
- Then the commitment status changes to "Carried Forward" and it continues to appear in the Pre-Meeting Brief for the next session

**Scenario: Broken commitment pattern flagged**
- Given a commitment has been Carried Forward 2 or more consecutive times
- When I view the teammate's Patterns section or Pre-Meeting Brief
- Then a pattern signal is shown: "Commitment '[text]' has been carried forward [N] times — consider discussing this directly."

---

## Story Coverage Summary

| Epic                          | Stories                              | FR Covered |
|-------------------------------|--------------------------------------|------------|
| Authentication & Account Setup| US-01, US-02, US-16                  | FR-01      |
| Teammate Profile Setup        | US-03, US-04                         | FR-02      |
| Meeting Ingestion             | US-05, US-06, US-07, US-08, US-17   | FR-03, FR-08 |
| Pattern Intelligence          | US-09                                | FR-04      |
| Pre-Meeting Brief             | US-10, US-11                         | FR-05      |
| Coaching Strategy Layer       | US-12                                | FR-06      |
| Growth Timeline               | US-13                                | FR-07      |
| Action & Commitment Tracker   | US-14, US-15                         | FR-08      |
| **Total**                     | **17**                               | FR-01–08   |
