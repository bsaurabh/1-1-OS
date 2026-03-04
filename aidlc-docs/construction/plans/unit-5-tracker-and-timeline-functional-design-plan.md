# Unit 5: Tracker & Timeline — Functional Design Plan

**Unit**: Unit 5: Tracker & Timeline
**Stories**: US-13 (Timeline), US-14 (Manual commitment), US-15 (Review/resolve commitments)
**Date**: 2026-03-02

---

## Pre-filled Q&A

**Q1: Does the commitment lifecycle extend the existing PATCH /api/commitments/[id] route or replace it?**
[Answer]: Extend it. The existing route handles `confirm` and `dismiss` for SUGGESTED status. Unit 5 adds `done`, `carried_forward`, `dropped` actions for OPEN/CARRIED_FORWARD status. The same route handles all commitment mutations via an `action` field.

**Q2: When a commitment is Carried Forward, what status does it transition to?**
[Answer]: OPEN → CARRIED_FORWARD (status changes to CARRIED_FORWARD, carryCount incremented by 1). If already CARRIED_FORWARD → CARRIED_FORWARD again (carryCount incremented again).

**Q3: Is the "broken commitment pattern" stored as a Pattern row or derived at read time?**
[Answer]: Derived at read time. The Patterns section on the teammate profile page queries commitments with carryCount >= 2 and displays them alongside Pattern rows. No new Pattern rows are written. This avoids duplication and keeps broken-commitment signals fresh.

**Q4: Does the timeline show ALL meetings (including PENDING_ANALYSIS) or only ANALYSIS_COMPLETE?**
[Answer]: All meetings regardless of status. Timeline shows date, one-line summary (if available, else "Analysis pending"), and tags. Tag filter only applies to meetings that have tags (ANALYSIS_COMPLETE).

**Q5: Is the AI growth summary part of US-13 or separate?**
[Answer]: Separate — on-demand via POST /api/timeline/[teammateId]/summary. The timeline page shows a "Generate Growth Summary" button; the summary is displayed inline and not persisted (same pattern as brief generation).

**Q6: Does duplicate detection for manual commitment creation (US-14) block creation or just warn?**
[Answer]: Warn. Return 409 with `{ duplicate: true, existingId }`. The UI shows a dialog: "A similar open commitment already exists. Add another or update the existing one?" with two buttons.

**Q7: Is dueDate required or optional for manual commitment creation?**
[Answer]: Optional. User may set a due date but it is not required.

**Q8: Does the commitment tracker page show ALL commitments (Open + Carried Forward + Done + Dropped) or only active ones?**
[Answer]: Active by default (OPEN + CARRIED_FORWARD). Done and Dropped appear in a collapsed "Resolved" section (show/hide toggle).

---

## Checklist

- [x] Step 1: Create plan file
- [x] Step 2: Analyze unit context (unit-of-work.md + stories US-13, US-14, US-15)
- [x] Step 3: Generate questions and answers
- [x] Step 4: Generate domain-entities.md
- [x] Step 5: Generate business-logic-model.md
- [x] Step 6: Generate business-rules.md
- [x] Step 7: Generate frontend-components.md
