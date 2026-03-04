# Story Generation Plan — 1:1OS

## Context
- **Project**: 1:1OS — AI Coaching Copilot for Design Managers
- **Requirements Source**: `aidlc-docs/inception/requirements/requirements.md`
- **Features in Scope**: FR-01 through FR-08 (Auth, Teammate Profile, Meeting Ingestion, Pattern Intelligence, Pre-Meeting Brief, Coaching Strategy, Growth Timeline, Action Tracker)

---

## Part 1: Planning Questions

Please answer each question by filling in the `[Answer]:` tag with the letter of your choice.
If none of the options fit, choose the last option (Other) and describe your preference after the tag.

---

### Question 1
How should the user stories be broken down and organized?

A) **Feature-Based** — one epic per feature (e.g., Epic: Teammate Profile, Epic: Meeting Ingestion). Stories within each epic cover all user interactions for that feature.
B) **User Journey-Based** — stories follow the manager's workflow chronologically: Onboarding → Before 1:1 → During/After 1:1 → Review Growth.
C) **Hybrid** — Feature-based epics, but ordered to reflect the manager's natural weekly workflow within each epic.
D) Other (please describe after [Answer]: tag below)

[Answer]:A

---

### Question 2
What level of granularity should individual stories be at?

A) **Fine-grained** — one story per distinct user interaction (e.g., "As a manager, I can click Record to start capturing audio"). Easier to estimate and assign individually.
B) **Medium-grained** — one story per meaningful user capability (e.g., "As a manager, I can record a voice summary of a 1:1 and have it transcribed"). Natural chunks for a small team.
C) **Epic + Sub-story** — define epics first, then break each into 2–4 sub-stories with their own acceptance criteria.
D) Other (please describe after [Answer]: tag below)

[Answer]:A

---

### Question 3
Should teammates be included as a secondary persona?
(Teammates don't use the app directly, but they are the subject of coaching data. A teammate persona could help define privacy and ethical boundaries.)

A) Yes — include a Teammate persona to anchor privacy, consent, and ethical use stories
B) No — focus only on the Design Manager as the sole user persona
C) Other (please describe after [Answer]: tag below)

[Answer]:B

---

### Question 4
What format should acceptance criteria use?

A) **BDD format** — Given / When / Then (structured, test-automation-friendly)
B) **Bullet list** — plain English checklist of conditions that must be true for the story to be done
C) **Hybrid** — bullet list for most stories, BDD for stories with complex conditional logic
D) Other (please describe after [Answer]: tag below)

[Answer]:A

---

### Question 5
For AI-generated outputs (Pre-Meeting Brief, Pattern Detection, Coaching Strategy suggestions), how should quality be defined in acceptance criteria?

A) **Output structure** — criteria defines what sections/fields must be present in the AI output (not the AI's reasoning quality)
B) **Output structure + fallback behavior** — structure requirements plus what happens when AI fails or produces low-confidence output
C) **Full quality bar** — structure + fallback + at least one example of a good vs bad output in the criteria
D) Other (please describe after [Answer]: tag below)

[Answer]:B

---

### Question 6
Should the Action Tracker (FR-08) be treated as a standalone epic or embedded within the Meeting Ingestion and Pre-Meeting Brief epics?

A) **Standalone epic** — Action Tracker has its own stories for creating, tracking, and reviewing commitments
B) **Embedded** — commitment logging is part of the Meeting Ingestion story; commitment surfacing is part of the Pre-Meeting Brief story
C) **Both** — standalone epic for the tracker view/management, plus embedded stories for where commitments appear within other flows
D) Other (please describe after [Answer]: tag below)

[Answer]:A

---

### Question 7
How many total user stories are you comfortable reviewing and approving?

A) Focused set — 15–20 stories covering the most critical paths only
B) Standard set — 25–35 stories covering all features with key edge cases
C) Comprehensive set — 40+ stories covering all features, edge cases, error states, and empty states
D) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## Part 2: Generation Execution Plan

### Step 1: Create Personas
- [x] Generate `aidlc-docs/inception/user-stories/personas.md`
  - [x] Primary persona: Design Manager (detailed profile based on PRD Section 3)
  - [x] Secondary persona (if Q3 = A): Teammate — SKIPPED (Q3 = B)

### Step 2: Create Story Epics Structure
- [x] Define epic list based on Q1 breakdown approach (Feature-based, 8 epics)
- [x] Confirm epic order reflects the answer to Q2 (fine-grained) and Q6 (Action Tracker standalone)

### Step 3: Generate Stories per Epic
- [x] Epic 1: Authentication & Account Setup (FR-01) — US-01, US-02
- [x] Epic 2: Teammate Profile Setup (FR-02) — US-03, US-04
- [x] Epic 3: Meeting Ingestion (FR-03) — US-05, US-06, US-07, US-08
- [x] Epic 4: Pattern Intelligence (FR-04) — US-09
- [x] Epic 5: Pre-Meeting Brief (FR-05) — US-10, US-11
- [x] Epic 6: Coaching Strategy Layer (FR-06) — US-12
- [x] Epic 7: Growth Timeline (FR-07) — US-13
- [x] Epic 8: Action & Commitment Tracker (FR-08) — US-14, US-15

### Step 4: Apply INVEST Criteria
- [x] Verified all 15 stories are Independent, Negotiable, Valuable, Estimable, Small, Testable
- [x] No stories required splitting or merging

### Step 5: Add Acceptance Criteria
- [x] BDD format (Given/When/Then) applied to all stories
- [x] AI output structure + fallback behavior included for US-03, US-09, US-10, US-12
- [x] At least one edge case per epic included

### Step 6: Map Personas to Stories
- [x] All 15 stories tagged to Design Manager persona
- [x] Full coverage confirmed

### Step 7: Final Review
- [x] Story count: 15 (within 15–20 focused range)
- [x] All FRs (FR-01 through FR-08) covered
- [x] Saved to `aidlc-docs/inception/user-stories/stories.md`
