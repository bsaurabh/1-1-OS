# Requirements Document — 1:1OS

**Version**: 1.0
**Date**: 2026-03-01
**Status**: Draft — Awaiting Approval

---

## Intent Analysis Summary

| Attribute         | Assessment                                                       |
|-------------------|------------------------------------------------------------------|
| **User Request**  | Build an AI-powered 1:1 coaching assistant for Design Managers  |
| **Request Type**  | New Project (Greenfield)                                        |
| **Scope**         | System-wide — full product build (frontend + backend + AI layer)|
| **Complexity**    | Complex — multi-feature AI application with long-term memory, pattern detection, voice input, multi-user data isolation |
| **Depth Level**   | Comprehensive                                                   |

---

## 1. Product Vision

**1:1OS** is an AI coaching copilot for Design Managers. It is not a note-taking tool — it is an intelligent system that maintains contextual memory per teammate, detects behavioral patterns over time, prepares the manager before each 1:1, and suggests strategic coaching actions.

> "An AI Design Director that helps Design Managers grow their teams."

---

## 2. Target User

**Primary Persona**: Design Manager in a fast-paced product organization (e.g., Upstox)
- Manages 5–10 designers
- Handles revenue-linked projects
- Balances IC + managerial responsibilities
- Wants structured, modern people management
- Values measurable growth in reportees

---

## 3. Functional Requirements

### FR-01: Authentication & Multi-User Support
- The system MUST support email + password authentication
- Each manager account MUST have completely isolated data (no cross-user data access)
- Multi-user deployment with per-manager data isolation from day one
- Standard session management with secure logout
- Password reset via email

### FR-02: Teammate Profile Setup (AI-Led Onboarding)
- Manager can create profiles for each of their direct reports
- Profile creation is driven by an AI-led onboarding interview:
  - AI asks structured questions in a conversational flow
  - Manager responds in natural language
  - AI synthesizes responses into a structured profile
- Each profile MUST capture:
  - Role and current level
  - Strengths (identified + self-reported)
  - Growth areas
  - Career aspirations
  - Current key projects and KPIs
  - Behavioral tendencies
  - Feedback style preference
  - Motivation drivers
  - Recent performance notes
- Profiles MUST be editable by the manager after creation
- AI generates a profile summary card displayed on the teammate dashboard

### FR-03: Meeting Ingestion Layer
The system MUST support three ingestion methods:

**Method A — Paste Summary**
- Rich text input field for pasting post-meeting notes
- Minimum: 50 characters; maximum: 50,000 characters

**Method B — Transcript Upload**
- Upload .txt, .docx, or .pdf files
- System extracts text and processes it as meeting content

**Method C — Voice Recording (Browser-based)**
- In-browser audio recording via browser MediaRecorder API
- Recording MUST be stopped and sent for transcription
- Transcription via external API (Whisper or Deepgram)
- Transcribed text displayed for manager review before saving
- Manager can edit transcription before final save

After ingestion (all methods), the AI MUST:
- Extract key themes from the meeting
- Identify emotional tone signals
- Detect unresolved items or open threads
- Detect recurring concerns or topics
- Tag each meeting with categories: Growth, Blocker, Motivation, Skill Gap, Conflict, Win, Accountability, Other

### FR-04: Pattern Intelligence Engine
- Analyzes ALL meeting history per teammate (full history, not a rolling window)
- Runs after each new meeting is ingested
- Detects and surfaces:
  - Repeated blockers (same issue across multiple meetings)
  - Avoided or skirted topics
  - Skill stagnation signals
  - Emotional dip patterns
  - Motivation fluctuations
  - Project overwhelm indicators
  - Performance improvement trends
  - Ownership behavior changes
- Each detected pattern MUST include:
  - Description of the pattern
  - Evidence (which meetings triggered it, with dates)
  - Severity level: Informational / Watch / Action Required
- Patterns displayed on the teammate's profile page

### FR-05: Pre-Meeting Brief Generator
- Manager clicks "Prepare" before a scheduled 1:1
- System generates a structured brief containing:
  - Context summary (last meeting recap + open threads)
  - Unresolved commitments from previous 1:1s
  - Active pattern signals for this teammate
  - Suggested coaching focus for this session
  - Risk signals (burnout, stagnation, disengagement)
  - 5–7 tailored follow-up questions based on recent context
  - One "uncomfortable but important" question the manager may be avoiding
- Brief is read-only and generated fresh each time
- Manager can regenerate the brief
- Brief can be downloaded or copied as plain text

### FR-06: Coaching Strategy Layer (Automatic)
- After meeting ingestion OR when generating the Pre-Meeting Brief, the AI MUST automatically select and apply the most relevant coaching framework for this teammate in this context
- Supported frameworks:
  - Situational Leadership (Blanchard)
  - Radical Candor (Scott)
  - Growth Mindset prompts (Dweck)
  - Deliberate Practice loops
  - Accountability loop structure
  - Psychological safety checks
- The AI MUST explain WHY it selected the framework for this individual
- The framework recommendation is embedded in the Pre-Meeting Brief

### FR-07: Growth Timeline View
- Per-teammate view showing meeting history as a tagged, chronological list
- Each entry shows: date, meeting themes (tags), AI-generated one-line summary
- Filterable by tag category (Growth, Blocker, Motivation, etc.)
- AI generates a current growth summary paragraph on demand
- Simple, scannable — no complex visual charts for MVP

### FR-08: Action & Commitment Tracker
- During or after each 1:1, manager can log:
  - Commitments made by the manager (e.g., "I will give Chirag more ownership on Strategy Builder")
  - Commitments made by the teammate
  - Follow-up items with optional due dates
- Each commitment is linked to a specific teammate
- System surfaces open commitments in the Pre-Meeting Brief for the next 1:1
- Commitments can be marked as: Open / Done / Carried Forward / Dropped
- Broken commitment patterns (commitments repeatedly carried forward or dropped) are flagged as a pattern signal

---

## 4. Non-Functional Requirements

### NFR-01: Platform
- Web application, browser-based
- Responsive design (desktop-first, must work on laptop screens at minimum)
- Chrome and Safari support required for MVP; Firefox as best-effort

### NFR-02: AI Provider
- Claude (Anthropic) as the primary LLM
- Recommended model: `claude-sonnet-4-6` for most operations; `claude-opus-4-6` for deep pattern analysis and pre-meeting brief generation
- All Claude API calls MUST include structured system prompts with full teammate context
- Contextual memory is assembled per-request from stored meeting data (not Claude's session memory)

### NFR-03: Data Storage
- Cloud-hosted PostgreSQL database
- Recommended: Supabase (managed PostgreSQL + auth + file storage)
- All sensitive data encrypted at rest (AES-256, managed by cloud provider)
- All data in transit over TLS 1.2+
- Each manager's data is row-level isolated in all tables

### NFR-04: Voice Transcription
- Browser MediaRecorder API for in-browser audio capture
- Audio chunks sent to transcription service (Whisper API or Deepgram)
- Transcription completed within 60 seconds for meetings up to 60 minutes
- Manager reviews and can edit transcript before it is saved

### NFR-05: Authentication
- Email + password authentication (Supabase Auth or NextAuth.js)
- JWT-based session tokens
- Session expires after 24 hours of inactivity
- Secure password hashing (bcrypt or Argon2)
- Password reset via email link

### NFR-06: Performance
- Pre-Meeting Brief generation: complete within 10 seconds for 95% of requests
- Pattern analysis: complete within 15 seconds after meeting ingestion
- Page load (time to interactive): < 3 seconds on standard broadband
- Audio transcription: < 60 seconds per hour of audio

### NFR-07: Privacy
- Basic privacy model for MVP:
  - Data stored in cloud DB with encryption at rest and in transit
  - No cross-user data leakage enforced at database and API layers
  - No data shared across manager accounts
  - Audio files deleted from storage after successful transcription
  - No automatic performance escalation to HR or org systems

### NFR-08: Scalability
- MVP designed to support up to 100 manager accounts with up to 10 teammates each
- Stateless API design to allow horizontal scaling when needed

### NFR-09: Usability
- Designed for one primary user type (Design Manager)
- Onboarding flow complete within 15 minutes for first teammate
- Pre-Meeting Brief accessible within 2 clicks from the homepage
- No training required — UI guided by contextual labels and empty states

---

## 5. MVP Feature Scope (Priority Order)

| Priority | Feature                    | In MVP | Notes                                         |
|----------|----------------------------|--------|-----------------------------------------------|
| 1        | Teammate Profile Setup     | YES    | AI-led onboarding interview (Q8: C)           |
| 2        | Meeting Ingestion          | YES    | Paste + upload + voice recording (Q4: B+ext)  |
| 3        | Pre-Meeting Brief          | YES    | Core coaching output                          |
| 4        | Pattern Intelligence       | YES    | Full meeting history analysis (Q7: B)         |
| 5        | Action & Commitment Tracker| YES    | Linked to Pre-Meeting Brief                   |
| 6        | Coaching Strategy Layer    | YES    | Fully automatic AI selection (Q12: A)         |
| 7        | Growth Timeline View       | YES    | Simple tagged list (Q13: A)                   |

---

## 6. Out of Scope for MVP

- Live meeting listening (Google Meet / Zoom integration)
- Slack, Jira, or calendar integrations
- Performance review auto-draft
- HR documentation generation
- Compensation recommendations
- Org-wide analytics dashboard
- Peer feedback ingestion
- Skip-level detection
- Bias detection module
- Mobile application

---

## 7. Technical Context

### Recommended Technology Stack

| Layer              | Technology                              | Rationale                                                       |
|--------------------|-----------------------------------------|-----------------------------------------------------------------|
| Framework          | Next.js 14+ (App Router, TypeScript)    | Fullstack, React-based, ideal for web AI apps                  |
| AI                 | Claude API (Anthropic SDK)              | Selected by user; best for nuanced long-form reasoning         |
| Database           | PostgreSQL via Supabase                 | Managed cloud Postgres + auth + file storage in one platform   |
| Auth               | Supabase Auth                           | Email + password built-in, JWT sessions                        |
| Voice Transcription| Browser MediaRecorder + Whisper API    | In-browser recording, accurate transcription                   |
| File Storage       | Supabase Storage                        | For transcript file uploads (.txt, .docx, .pdf)                |
| ORM                | Prisma                                  | Type-safe DB queries, migration management                     |
| Deployment         | Vercel                                  | Seamless Next.js deployment, serverless functions              |
| Styling            | Tailwind CSS                            | Rapid UI development, consistent design system                 |

### Key Integration Points
- **Anthropic API**: Claude claude-sonnet-4-6 / claude-opus-4-6 — meeting analysis, profile generation, brief generation, pattern detection, coaching strategy selection
- **Whisper API** (OpenAI) or **Deepgram**: Audio transcription for voice recordings
- **Supabase**: Database, auth, and file storage

### Data Model Overview (Conceptual)
```
Manager (User)
  |-- Teammates (direct reports)
        |-- TeammateProfile (AI-generated + manually edited)
        |-- Meetings (ingested sessions)
              |-- MeetingThemes (tags + AI extractions)
        |-- Patterns (detected across meetings)
        |-- Commitments (action items + follow-ups)
```

---

## 8. User Scenarios

### Scenario 1: Onboarding a New Teammate
Manager adds a new direct report. AI conducts a structured onboarding interview asking about the teammate's background, strengths, growth areas, and career goals. AI synthesizes responses into a structured profile card.

### Scenario 2: Post-1:1 Meeting Ingestion
After a 1:1, manager either pastes their notes, uploads a transcript file, or records a voice summary using the browser. AI processes the content, extracts themes, detects emotional tone, tags unresolved items, and updates the teammate's pattern model.

### Scenario 3: Pre-Meeting Preparation
Before the next 1:1, manager clicks "Prepare" on a teammate's page. AI generates a full brief in under 10 seconds: context summary, open commitments, active pattern signals, coaching framework recommendation, and 6 tailored questions including one uncomfortable question.

### Scenario 4: Pattern Detected
After 3 consecutive meetings, the system detects: "Chirag has mentioned bandwidth concerns in 3 of the last 4 1:1s." This pattern is flagged as Watch level and surfaced in the next Pre-Meeting Brief with a suggested coaching question.

### Scenario 5: Action Tracking
Manager logs "I will assign ownership of the Strategy Builder audit to Chirag by next Friday." This commitment appears in the next brief. If not marked Done, it is flagged as a repeated carry-forward.

---

## 9. Success Metrics (MVP)

| Metric                              | Target                          |
|-------------------------------------|---------------------------------|
| Prep time reduction per 1:1         | < 5 minutes to prepare (vs 20+ manually) |
| Follow-up consistency               | 80%+ of commitments tracked     |
| Pre-Meeting Brief accuracy          | Manager rates brief as useful 4/5 sessions |
| Time to first brief (onboarding)    | < 15 minutes for first teammate |
| Pattern detection relevance         | Manager confirms pattern in 3/4 detections |

---

## 10. Risks

| Risk                               | Mitigation                                          |
|------------------------------------|-----------------------------------------------------|
| Generic AI coaching advice         | System prompts must include full teammate context; no generic responses |
| Emotional misinterpretation        | AI signals shown as "signals", not diagnoses; manager has final judgment |
| Over-reliance on AI recommendations| Brief presented as suggestions, not directives      |
| Privacy concerns from reportees    | No recording without manager's explicit initiation; audio deleted after transcription |
| Coaching turned into formula       | Coaching Strategy Layer explained with "why", not just "what" |

---

## 11. Extension Configuration

| Extension        | Enabled | Decided At              |
|------------------|---------|-------------------------|
| Security Baseline| No      | Requirements Analysis   |

*Security rules skipped as this is a PoC/prototype phase.*

---
