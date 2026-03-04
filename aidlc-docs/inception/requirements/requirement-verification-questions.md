# Requirements Clarification Questions — 1:1OS

Thank you for the detailed PRD! The vision is clear: an AI coaching copilot for Design Managers.
To ensure the right technical and product decisions, please answer the following questions.

Fill in each `[Answer]:` tag with the letter of your chosen option (e.g., `[Answer]: A`).
If none of the options match, choose the last option (Other) and describe your preference after the tag.

---

## Question 1
What is the primary deployment platform for the MVP?

A) Web application (browser-based, accessible from any device)
B) Desktop application (Mac/Windows native app)
C) Both web and desktop
D) Mobile app (iOS/Android)
E) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 2
Which AI/LLM provider should power the intelligence layer?

A) Claude (Anthropic) — best for nuanced conversation and long-form reasoning
B) GPT-4 / GPT-4o (OpenAI)
C) Gemini (Google)
D) Flexible / provider-agnostic (use abstraction layer to switch easily)
E) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 3
Where should user data (1:1 notes, teammate profiles, meeting summaries) be stored?

A) Cloud database (managed by the product, e.g., PostgreSQL on cloud)
B) Local-first storage on the user's machine (SQLite / local DB), with optional cloud sync later
C) Browser local storage only (fully client-side, no backend for MVP)
D) Other (please describe after [Answer]: tag below)

[Answer]:A
---

## Question 4
For the MVP, which meeting ingestion method(s) should be supported?
(The PRD lists: live listening, transcript upload, paste summary, voice summary)

A) Paste meeting summary only (simplest MVP — text input)
B) Paste summary + transcript upload (text file / .txt / .docx)
C) All text-based methods (paste + upload + voice-to-text via browser)
D) Other (please describe after [Answer]: tag below)

[Answer]:B Have a voice recording feature too to record the meeting and transcribe it.

---

## Question 5
How will the user authenticate / access the application?

A) Single user — no auth needed for MVP (designed for one manager, runs locally or on their account)
B) Email + password (basic auth, single user or small team)
C) Google Sign-In / OAuth (log in with Google account)
D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 6
For the MVP, which features from the PRD are highest priority?
The PRD lists: Teammate Profile Setup, Meeting Ingestion, Pattern Intelligence, Pre-Meeting Brief, Coaching Strategy Layer, Growth Timeline, Action Tracker.

A) Core loop: Teammate Profiles + Meeting Ingestion + Pre-Meeting Brief (minimum viable coaching)
B) Core loop + Pattern Intelligence + Action Tracker (adds memory and accountability)
C) All features listed in the PRD Section 6 (full MVP as defined)
D) Other (please describe after [Answer]: tag below)

[Answer]:B

---

## Question 7
For the Pattern Intelligence Engine, how much meeting history should the system analyze to detect patterns?

A) Last 4 meetings per teammate (rolling window)
B) All meetings ever recorded (full history)
C) Last 90 days of meetings
D) Other (please describe after [Answer]: tag below)

[Answer]:B

---

## Question 8
How should teammate profile data be initially created?

A) 100% manual input by the manager (fill in a structured form)
B) Manager fills a form, then AI generates a summary + suggests missing fields
C) AI conducts a guided onboarding interview (asks questions, builds profile from answers)
D) Other (please describe after [Answer]: tag below)

[Answer]:C

---

## Question 9
What is your preferred frontend technology?

A) React (TypeScript) — modern, component-based
B) Next.js (React + SSR) — web app with server-side capabilities
C) Vue.js
D) No preference — choose what best fits the architecture
E) Other (please describe after [Answer]: tag below)

[Answer]:D

---

## Question 10
What is your preferred backend technology?

A) Node.js / Express or Fastify (TypeScript)
B) Python / FastAPI — strong AI/ML ecosystem integration
C) Next.js API routes (fullstack in one framework)
D) No preference — choose what best fits
E) Other (please describe after [Answer]: tag below)

[Answer]:D

---

## Question 11
The PRD mentions "local encryption" under Privacy. How strictly should privacy be handled in MVP?

A) Basic: data stored in cloud DB with standard encryption at rest and in transit (TLS)
B) Strict: local-first storage, data never leaves the user's machine without explicit export
C) Enterprise-grade: full encryption, audit logs, consent management from day one
D) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## Question 12
Should the Coaching Strategy Layer (Section 6.5) suggest frameworks automatically based on meeting content, or should the manager select from a menu?

A) Fully automatic — AI picks the framework based on conversation analysis
B) AI suggests 1-2 frameworks with rationale, manager confirms
C) Manager browses a library and manually selects the framework
D) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## Question 13
For the Growth Timeline View (Section 6.6), what is the minimum viable visualization for MVP?

A) Simple list of meeting summaries per teammate with tags/themes
B) Timeline view with milestones, skill progression bars, and burnout risk indicator
C) Text-based growth summary generated by AI (no visual timeline for MVP)
D) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## Question 14
Should the app support multiple manager accounts (multi-tenant) in MVP, or is this a single-user tool?

A) Single manager only (solo tool, MVP)
B) Multi-user with isolated data per manager (each manager sees only their team)
C) Team/org level (managers can share visibility on cross-team patterns)
D) Other (please describe after [Answer]: tag below)

[Answer]:B

---

## Question: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)
B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)
X) Other (please describe after [Answer]: tag below)

[Answer]:B

---
