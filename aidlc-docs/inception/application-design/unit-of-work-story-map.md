# Unit of Work Story Map — 1:1OS

**Date**: 2026-03-01
**Total stories**: 17 (US-01 through US-17)
**All stories assigned**: Yes

---

## Story-to-Unit Mapping

### Unit 1: Foundation

| Story | Title | Notes |
|-------|-------|-------|
| US-01 | Sign up for an account | Full register flow with validation |
| US-02 | Log in and log out | Login, session expiry, logout |
| US-16 | Reset a forgotten password | Reset link generation, expiry, single-use |

**Story count**: 3

---

### Unit 2: Teammate Profiles

| Story | Title | Notes |
|-------|-------|-------|
| US-03 | Add a new teammate and start the AI onboarding interview | Full Claude interview flow + profile synthesis + fallback |
| US-04 | Review and edit a teammate's profile | Manual field editing, save, incomplete profile warning |

**Story count**: 2

---

### Unit 3: Meeting Ingestion

| Story | Title | Notes |
|-------|-------|-------|
| US-05 | Paste a meeting summary | Text input, 50-char validation, AI analysis queued, commitment extraction scenario |
| US-06 | Upload a meeting transcript file | .txt/.docx/.pdf, 10MB limit, file parsing, commitment extraction scenario |
| US-07 | Record a voice meeting summary and have it transcribed | Browser MediaRecorder, Supabase Storage, Whisper API, audio deletion |
| US-08 | Review and edit a transcription before saving | Edit transcription, save & analyze, discard |
| US-17 | Review and confirm AI-extracted commitments from a meeting | Confirm / dismiss / edit suggested commitments, fallback |

**Story count**: 5

---

### Unit 4: Intelligence Engine

| Story | Title | Notes |
|-------|-------|-------|
| US-09 | View detected patterns for a teammate | Pattern list with severity, empty state, fallback |
| US-10 | Generate a pre-meeting brief for a teammate | Full brief with all sections, fallback, empty history state |
| US-11 | Regenerate or copy the pre-meeting brief | Regenerate and copy-to-clipboard |
| US-12 | View the AI-selected coaching framework and rationale | Framework name + rationale + actions in brief, fallback |

**Story count**: 4

---

### Unit 5: Tracker & Timeline

| Story | Title | Notes |
|-------|-------|-------|
| US-13 | View a teammate's meeting history with tags and filter by category | Chronological list, tag filter, empty state |
| US-14 | Manually add a commitment after a 1:1 | Manager or teammate commitment, manual entry |
| US-15 | Review open commitments and mark them as resolved | Done / Carried Forward / Dropped, broken pattern flag |

**Story count**: 3

---

## Summary

| Unit | Stories | Count |
|------|---------|-------|
| Unit 1: Foundation | US-01, US-02, US-16 | 3 |
| Unit 2: Teammate Profiles | US-03, US-04 | 2 |
| Unit 3: Meeting Ingestion | US-05, US-06, US-07, US-08, US-17 | 5 |
| Unit 4: Intelligence Engine | US-09, US-10, US-11, US-12 | 4 |
| Unit 5: Tracker & Timeline | US-13, US-14, US-15 | 3 |
| **Total** | | **17** |

All 17 stories assigned. No story appears in more than one unit.

---

## Cross-Unit Story Dependencies

These are stories in later units whose implementation depends on features delivered by earlier units.

| Story | Unit | Depends on Story | From Unit | Dependency |
|-------|------|-----------------|-----------|------------|
| US-05 | 3 | US-03 | 2 | Needs teammate profile as AI context in analysis prompt |
| US-09 | 4 | US-05/06/07 | 3 | Patterns require at least 2 analyzed meetings |
| US-10 | 4 | US-05/06/07, US-17 | 3 | Brief surfaces open commitments from ingestion |
| US-12 | 4 | US-10 | 4 | Coaching strategy is a section within the brief |
| US-13 | 5 | US-05/06/07 | 3 | Timeline requires analyzed meetings with tags |
| US-15 | 5 | US-17 | 3 | Broken pattern detection requires carried-forward commits |
