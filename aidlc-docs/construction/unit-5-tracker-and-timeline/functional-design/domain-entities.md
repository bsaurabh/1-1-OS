# Domain Entities — Unit 5: Tracker & Timeline

**Date**: 2026-03-02
**Unit**: Unit 5: Tracker & Timeline

---

## Existing Entities (No Schema Changes in Unit 5)

Unit 5 requires **zero Prisma schema changes**. All required entities and enums are already present from Unit 1.

---

## Entity: Commitment (existing — fully utilized in Unit 5)

```
Commitment {
  id          String           PK
  managerId   String           FK → Manager
  teammateId  String           FK → Teammate
  meetingId   String?          FK → Meeting (null for manually created)
  text        String           commitment description
  owner       CommitmentOwner  MANAGER | TEAMMATE
  status      CommitmentStatus SUGGESTED | OPEN | CARRIED_FORWARD | DONE | DROPPED
  dueDate     DateTime?        optional target date
  carryCount  Int              number of times carried forward (default 0)
  createdAt   DateTime
  updatedAt   DateTime
}
```

### Commitment Status Lifecycle

```
SUGGESTED ──confirm──► OPEN ──done──────────────► DONE
                         │
                         ├──carried_forward──► CARRIED_FORWARD ──done──► DONE
                         │                           │
                         │                           └──carried_forward──► CARRIED_FORWARD (carryCount++)
                         │
                         └──dropped──────────────► DROPPED

SUGGESTED ──dismiss──► (deleted)
```

### Manually Created Commitments (US-14)
- Created directly with status OPEN (bypasses SUGGESTED state)
- meetingId is null (not associated with any specific meeting)
- owner is explicitly set by manager (MANAGER or TEAMMATE)
- dueDate is optional

### Broken Commitment Pattern Signal (US-15)
- Derived at read time (not persisted as a Pattern row)
- Any Commitment with carryCount >= 2 is surfaced as a pattern signal
- Signal text: "Commitment '[text]' has been carried forward [N] times — consider discussing this directly."

---

## Entity: Meeting (existing — used for timeline in US-13)

```
Meeting {
  id          String           PK
  managerId   String           FK → Manager
  teammateId  String           FK → Teammate
  rawText     String           original input text
  source      MeetingSource    PASTE | UPLOAD | VOICE
  status      AnalysisStatus   PENDING_ANALYSIS | ANALYSIS_COMPLETE | ANALYSIS_FAILED
  themes      Json?            extracted themes (array of strings)
  tags        String[]         category tags (ANALYSIS_COMPLETE only)
  summary     String?          one-line AI summary
  tone        String?          meeting tone
  createdAt   DateTime
  updatedAt   DateTime
}
```

### Timeline Display (US-13)
- All meetings shown regardless of analysis status
- Reverse-chronological order (most recent first)
- summary field shown if available, else "Analysis in progress..."
- tags shown if available; tag filter only affects ANALYSIS_COMPLETE meetings
- No pagination in MVP (list all)

---

## Value Object: GrowthSummary (transient, not persisted)

```
GrowthSummary {
  teammateName:     string       teammate name
  generatedAt:      string       ISO timestamp
  narrative:        string       2-3 paragraph AI-generated growth narrative
  keyThemes:        string[]     recurring themes across all meetings
  growthSignals:    string[]     positive developments identified
  coachingGaps:     string[]     areas still needing attention
}
```

- Generated on-demand via POST /api/timeline/[teammateId]/summary
- Never persisted in the database (same pattern as Brief — BR-4.07 equivalent)
- Based on all ANALYSIS_COMPLETE meeting summaries

---

## Value Object: CommitmentCreateInput (for manual creation)

```
CommitmentCreateInput {
  text:    string           commitment description (required, non-empty)
  owner:   MANAGER|TEAMMATE  who owns this commitment (required)
  dueDate: string?          optional ISO date string
}
```

---

## Value Object: TimelineMeetingEntry (read model for timeline)

```
TimelineMeetingEntry {
  id:        string
  source:    PASTE|UPLOAD|VOICE
  status:    PENDING_ANALYSIS|ANALYSIS_COMPLETE|ANALYSIS_FAILED
  summary:   string | null
  tags:      string[]
  createdAt: string            ISO timestamp
}
```

---

## Enum: CommitmentOwner (existing)
```
MANAGER | TEAMMATE
```

## Enum: CommitmentStatus (existing)
```
SUGGESTED | OPEN | CARRIED_FORWARD | DONE | DROPPED
```

## Allowed Timeline Tag Values (from Unit 3)
```
Growth | Blocker | Motivation | Skill Gap | Conflict | Win | Accountability | Other
```
