# Unit of Work Plan — 1:1OS

## Context
- **Architecture**: Single Next.js app (Pages Router) — units are logical development groupings, not independently deployed services
- **Proposed units** (from Workflow Planning): 5 units — Foundation, Teammate Profiles, Meeting Ingestion, Intelligence Engine, Tracker & Timeline
- **Components**: 13 (see application-design/components.md)

---

## Part 1: Clarifying Questions

Two decisions needed before generating the unit artifacts.

---

### Question 1
How should the Next.js project source code be organized inside the repository?

A) **Feature-based folders** — `src/features/auth/`, `src/features/teammates/`, `src/features/meetings/`, etc. Each feature folder contains its pages, components, API handlers, and business logic together.
B) **Type-based folders** — `pages/`, `components/`, `lib/`, `services/` at the top level. Code organized by what it is, not which feature it belongs to.
C) Other (please describe after [Answer]: tag below)

[Answer]:b

---

### Question 2
Can units be developed in parallel or must they be strictly sequential?

A) **Strictly sequential** — complete each unit fully (code + tests) before starting the next. Simpler coordination, works well for solo or small teams.
B) **Parallel where possible** — Unit 1 must finish first, but Units 2 and 3 can be built simultaneously once Unit 1 is done. Unit 4 and 5 follow in sequence.
C) Other (please describe after [Answer]: tag below)

[Answer]:a

---

## Part 2: Generation Execution Plan

*Executes after answers are received and approved.*

### Step 1: Generate unit-of-work.md
- [x] Define all 5 units with names, purpose, scope, and included components
- [x] Document code organization strategy (type-based folders per Q1: B)
- [x] Specify entry/exit criteria for each unit

### Step 2: Generate unit-of-work-dependency.md
- [x] Dependency matrix showing which units depend on which
- [x] Build sequence with rationale (strictly sequential per Q2: A)
- [x] Cross-unit interface contracts documented
- [x] Risk points identified

### Step 3: Generate unit-of-work-story-map.md
- [x] Map all 17 user stories to their respective units
- [x] All stories assigned — confirmed
- [x] Cross-unit story dependencies flagged

### Step 4: Validate
- [x] All 17 stories assigned (3+2+5+4+3=17)
- [x] No unit is empty
- [x] Dependency graph is acyclic (linear chain)
- [x] Component-to-unit mapping complete

---

*Awaiting answers before executing Part 2.*
