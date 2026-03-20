# Requirements Document
## AI Excel Insights Dashboard — Unit 7

**Date**: 2026-03-19
**Project**: 1:1OS
**Feature**: AI Excel Insights Dashboard
**Status**: Approved

---

## Intent Analysis

| Field | Value |
|---|---|
| **User Request** | Upload Excel/CSV → auto-generate structured dashboard + actionable AI insights |
| **Request Type** | New Feature |
| **Scope Estimate** | Multiple Components (upload, parsing, AI engine, dashboard UI, export, persistence) |
| **Complexity Estimate** | Complex — file parsing, schema inference, AI insights generation, data visualization, Supabase persistence |

---

## Decisions from Clarifying Questions

| # | Question | Answer |
|---|---|---|
| Q1 | Dashboard persistence | **B** — Save per upload; user can revisit past analyses |
| Q2 | Export format | **C** — CSV/Excel export of metrics |
| Q3 | Conversational layer | **C** — Skip for MVP; insights + dashboard only |
| Q4 | File storage | **A** — In-memory only; file never persisted to storage |
| Q5 | Access scope | **A** — Any logged-in user (data scoped per user) |
| Q6 | App placement | **C** — Sidebar nav item (new route `/insights`) |
| Q7 | Beta tag | **B** — No tag |

---

## Functional Requirements

### FR1 — File Upload
- User can drag & drop or click-to-upload `.xlsx` or `.csv` files
- Multi-sheet Excel files: user selects which sheet(s) to analyse
- File is processed in-memory; never written to disk or Supabase storage
- Show file preview (column names + first 5 rows) before processing

### FR2 — Smart Schema Detection
- Auto-detect columns: Item Name, Status, Size (S/M/L), Created Date, Completed Date, Revenue Impact
- Normalize status values (e.g. "Done", "Finished" → "Completed")
- If required columns are missing or ambiguous → prompt user for manual column mapping
- Support for custom column names that map to standard schema

### FR3 — Dashboard Generation
Generate a structured dashboard with the following metric panels:

**Delivery Metrics**
- Item count by status (Planned / In Progress / Completed)
- Distribution by size (S / M / L)
- Completion rate (%)

**Time Metrics**
- Average turnaround time (overall and per size)
- Time spent in each status (if date columns present)
- Delay detection vs. expected timelines (if available)

**Business Impact**
- Total revenue impact
- Monthly revenue shipped
- Revenue per item (efficiency metric)

**Throughput**
- Items completed per month (trend)
- Velocity trend (improving / stable / declining)

**Quality Signals** (if data available)
- Rework rate
- Iteration count

### FR4 — Insights Engine
- Claude generates 3–7 narrative insights from the data
- Insights are ranked by significance
- Examples: "L-sized items take 2.3x longer — potential scoping issue", "70% of revenue came from 20% of items"
- Insights displayed as cards with key stat highlighted

### FR5 — Recommendations Engine
- Claude identifies missing columns and recommends additions
- Examples: "Add 'Start Date' to track actual turnaround", "Add 'Design Iterations' to measure quality"
- Only shown when relevant gaps are detected

### FR6 — Dashboard Persistence
- Each analysis run is saved to Supabase (user-scoped)
- Saved record includes: upload filename, analysis timestamp, parsed metrics, insights, recommendations
- User can view a list of past analyses from the sidebar
- User can click any past analysis to reload the full dashboard

### FR7 — CSV/Excel Export
- User can export the computed metrics as a `.csv` or `.xlsx` file
- Export includes: all metric tables (delivery, time, business impact, throughput)
- Insights and recommendations exported as a separate sheet/section

### FR8 — Navigation Integration
- New sidebar nav item: "Insights" (route: `/insights`)
- Landing page shows: upload area + list of past analyses
- After upload + analysis: show full dashboard view

### FR9 — Edge Cases
- Missing required columns → block analysis, show clear mapping UI
- Multiple sheets → sheet selector modal before processing
- Inconsistent naming → auto-normalise with visible mapping shown to user
- Empty dataset → show "No data found" message
- Files > 10MB → warn user and reject gracefully

---

## Non-Functional Requirements

### NFR1 — Performance
- Time to insight: < 10 seconds for files up to 1000 rows
- Dashboard renders < 2 seconds after AI response received
- Schema detection: < 1 second for files up to 10,000 rows

### NFR2 — AI Quality
- Schema auto-detection accuracy target: > 80% without user correction
- Insights relevance: actionable and specific (not generic)
- Use Claude claude-sonnet-4-6 (existing integration) for insights + recommendations

### NFR3 — Data Privacy
- Uploaded file is never persisted; processed in Node.js API route memory only
- Only computed metrics + insights are stored in Supabase (not raw data)
- All Supabase rows include `user_id` — data is fully user-scoped

### NFR4 — Usability
- Insight-first layout: insights cards above charts
- Minimal required input from user
- Progressive disclosure: summary view → expand for details
- Mobile-responsive layout

### NFR5 — Reliability
- Graceful error handling for malformed files
- AI call failures degrade gracefully (show partial dashboard with error notice)
- No silent failures — all errors surfaced to user

### NFR6 — Compatibility
- `.xlsx` support via `xlsx` / `exceljs` npm library (no external service)
- `.csv` support via native parsing
- Existing Next.js + Supabase + Claude stack — no new infra required

---

## Data Model (Supabase)

### Table: `excel_analyses`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users |
| `filename` | text | Original upload filename |
| `analysed_at` | timestamptz | When analysis ran |
| `schema_mapping` | jsonb | Detected column → standard field mapping |
| `metrics` | jsonb | All computed metric values |
| `insights` | jsonb | Array of insight strings |
| `recommendations` | jsonb | Array of recommendation strings |
| `row_count` | integer | Number of data rows parsed |
| `sheet_name` | text | Sheet selected (if multi-sheet) |

---

## Tech Stack (Existing — No Changes)

| Layer | Technology |
|---|---|
| Frontend | Next.js (TypeScript), Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| AI | Claude claude-sonnet-4-6 via Anthropic SDK |
| File Parsing | `xlsx` npm package |
| Auth | Supabase Auth |

---

## Success Metrics

| Metric | Target |
|---|---|
| Time to insight | < 10 seconds |
| Schema auto-detection rate | > 80% |
| Zero file persistence | No raw data in storage |
| Past analyses retrievable | 100% for logged-in users |

---

## Out of Scope (MVP)

- Conversational Q&A / chat with data (deferred)
- PDF export (deferred)
- Jira / Notion / Figma integrations (future)
- Auto-weekly reports (future)
- Team-level comparisons (future)
- Predictive insights (future)
