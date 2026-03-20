# Requirements Verification Questions
## AI Excel Insights Dashboard — Unit 7

**Instructions**: Answer each question using the `[Answer]:` tag below each question.
Fill in with the letter of your choice (e.g., `[Answer]: A`) or describe a custom answer.

---

## Q1: Dashboard Persistence
Should generated dashboards be saved and retrievable later, or is this a session-only tool?

A) Session-only — no saving needed (upload → view → done)
B) Save dashboards per upload (user can revisit past uploads)
C) Save dashboards + allow naming/organizing them
D) X) Other (please describe after [Answer]: tag below)

[Answer]: B — Save per upload (revisitable)

---

## Q2: Export Format
The PRD mentions export as an open question. What format(s) should be supported?

A) None for now — view only
B) PDF only
C) CSV/Excel (raw metrics)
D) PDF + CSV/Excel
E) X) Other (please describe after [Answer]: tag below)

[Answer]: C — CSV/Excel

---

## Q3: Conversational Layer (Follow-up Questions)
For the "ask follow-up questions" feature — what's the expected scope for MVP?

A) Simple Q&A against the uploaded data (filter/lookup style)
B) Full Claude-powered conversation with full context of the data
C) Skip for now — insights + dashboard only (add chat later)
D) X) Other (please describe after [Answer]: tag below)

[Answer]: C — Skip for now

---

## Q4: File Storage
When a user uploads an Excel/CSV file, how should it be handled server-side?

A) Process in-memory only — do not store the file at all
B) Store temporarily (auto-delete after 24h)
C) Store permanently in Supabase storage
D) X) Other (please describe after [Answer]: tag below)

[Answer]: A — In-memory only

---

## Q5: Access Scope
Is this feature just for you (Saurabh) or any logged-in user?

A) Any logged-in user can upload and get their own insights
B) Single user (just me — no extra scoping needed)
C) X) Other (please describe after [Answer]: tag below)

[Answer]: A — Any logged-in user

---

## Q6: App Placement
Where should this feature live in the existing 1:1OS navigation?

A) New top-level page (e.g., `/insights` or `/excel`)
B) Within the existing main dashboard
C) Standalone tool accessible from the sidebar nav
D) X) Other (please describe after [Answer]: tag below)

[Answer]: C — Sidebar nav item

---

## Q7: Beta Tag
The Design Critique Engine was tagged "(Beta)". Should this feature also carry a Beta label?

A) Yes — tag as Beta
B) No tag needed
C) X) Other label (please describe after [Answer]: tag below)

[Answer]: B — No tag

---
