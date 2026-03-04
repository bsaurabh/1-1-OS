# Unit 4: Intelligence Engine — Functional Design Plan

**Unit**: Unit 4: Intelligence Engine
**Stories**: US-09 (View patterns), US-10 (Generate brief), US-11 (Regenerate/copy brief), US-12 (View coaching framework)
**Date**: 2026-03-02

---

## Pre-filled Context Analysis

Unit 4 depends on Unit 3 (meeting analysis produces themes/tags/tone). It adds:
1. **PatternDetectionHandler** — detects recurring patterns across meeting history; called by Unit 3's cron after analysis completes
2. **BriefGenerationHandler** — on-demand brief assembly (all sections) via Claude Sonnet
3. **CoachingStrategyHandler** — selects coaching framework, called by BriefGenerationHandler

All three handlers are new. No existing lib files need modification (pattern detection piggybacks on the Unit 3 cron via a chained call).

---

## Checklist

- [x] Step 1: Analyze unit context (unit-of-work.md + story map)
- [x] Step 2: Review stories US-09, US-10, US-11, US-12
- [x] Step 3: Identify all functional design questions
- [x] Step 4: Answer questions from existing context
- [x] Step 5: Generate domain-entities.md
- [x] Step 6: Generate business-logic-model.md
- [x] Step 7: Generate business-rules.md
- [x] Step 8: Generate frontend-components.md

---

## Questions & Answers

**Q1: When does pattern detection run — on demand, or chained after each meeting analysis?**
[Answer]: Chained after each meeting analysis completes (inside MeetingAnalysisHandler.onComplete). Not a separate API call — runs synchronously within the cron function after `ANALYSIS_COMPLETE` is set.

**Q2: What constitutes a "pattern"? What is the minimum number of meetings required?**
[Answer]: 2+ meetings required. A pattern is a recurring theme or tag that appears in ≥2 meetings. Pattern categories: BEHAVIORAL (recurring behavioral traits), BLOCKER (recurring obstacles), GROWTH (repeated growth signals), MOTIVATION (consistent motivation signals), COMMITMENT (carried-forward commitments flagged separately in Unit 5).

**Q3: How are pattern severity levels determined?**
[Answer]: PatternDetectionHandler uses Claude to classify severity after seeing full meeting history context:
- INFORMATIONAL — trend worth noting, no action needed
- WATCH — pattern that may need attention soon
- ACTION_REQUIRED — recurring issue requiring direct coaching action

**Q4: What data does the Pre-Meeting Brief include?**
[Answer]: Per US-10 acceptance criteria:
1. Context summary (last meeting recap + open threads)
2. Open commitments (status=OPEN or CARRIED_FORWARD)
3. Active pattern signals (severity WATCH + ACTION_REQUIRED)
4. Suggested coaching focus (1-2 sentences)
5. Risk signals (any ACTION_REQUIRED patterns)
6. 5–7 tailored follow-up questions
7. One "uncomfortable but important" question
8. Coaching Approach section (US-12): framework name + 2-3 sentence rationale + 1-2 coaching actions

**Q5: Is the brief stored in the database or always generated fresh?**
[Answer]: Always generated fresh on demand (not persisted). No Brief model needed in the schema. BriefGenerationHandler returns a structured object; the page renders it from the API response.

**Q6: What coaching frameworks does CoachingStrategyHandler select from?**
[Answer]: A curated set of 6 frameworks:
- GROW (Goals, Reality, Options, Will)
- SBI (Situation, Behavior, Impact — for feedback delivery)
- Strengths-Based Coaching
- OSCAR (Outcome, Situation, Choices, Actions, Review)
- Socratic Questioning
- Motivational Interviewing
CoachingStrategyHandler receives teammate profile + recent patterns and selects the best fit via Claude. Falls back to "general open-ended questions" if insufficient context.

**Q7: What is the fallback when BriefGenerationHandler fails?**
[Answer]: Per US-10: Display open commitments + last meeting raw summary as a structured fallback. No blank screen. Brief endpoint returns `{ brief: null, fallback: { commitments, lastMeeting } }` and the page renders the fallback section.

**Q8: Does regenerate (US-11) differ from generate?**
[Answer]: No — `POST /api/brief/[teammateId]/generate` is called again. The page replaces the displayed brief. No separate endpoint needed.

**Q9: How does pattern detection interact with the existing Pattern model in the schema?**
[Answer]: PatternDetectionHandler reads all meetings for a teammate, detects new patterns via Claude, then upserts Pattern rows (description + severity + evidence JSON). Existing patterns are compared against newly detected ones to avoid duplicates. Evidence JSON contains meeting IDs + dates.

**Q10: Where in the teammate page are patterns displayed?**
[Answer]: In a "Patterns" section on the existing teammate profile page (`pages/teammates/[id]/index.tsx`), below the profile view. The SSR function loads patterns alongside the teammate data. An empty state is shown if < 2 meetings exist.
