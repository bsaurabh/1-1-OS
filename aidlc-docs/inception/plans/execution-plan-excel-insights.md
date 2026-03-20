# Execution Plan — AI Excel Insights Dashboard (Unit 7)

**Date**: 2026-03-19
**Feature**: AI Excel Insights Dashboard
**Project**: 1:1OS (Brownfield)

---

## Detailed Analysis Summary

### Change Impact Assessment

| Area | Impact | Description |
|---|---|---|
| User-facing | Yes | New sidebar nav item, new page `/insights`, upload + dashboard UI |
| Structural | Minor | New route + components added alongside existing 6 units |
| Data model | Yes | New `excel_analyses` table in Supabase |
| API changes | Yes | New API routes: upload, analyse, list, export |
| NFR impact | Low | Existing stack handles all NFRs; no new infra |

### Risk Assessment

| Factor | Level |
|---|---|
| Overall Risk | **Medium** |
| Rollback Complexity | Easy (new table + new routes — no changes to existing code) |
| Testing Complexity | Moderate (file parsing + AI integration + persistence) |
| External Dependencies | `xlsx` npm package (file parsing) |

### Key Architectural Note
All changes are **additive** — no existing Unit 1–6 code is modified. This is a clean new unit alongside existing features.

---

## Workflow Visualization

```
INCEPTION PHASE
  [x] Workspace Detection .............. COMPLETE
  [x] Reverse Engineering .............. SKIPPED (artifacts exist)
  [x] Requirements Analysis ............ COMPLETE
  [ ] User Stories ..................... SKIP
  [x] Workflow Planning ................ IN PROGRESS
  [ ] Application Design ............... SKIP
  [ ] Units Generation ................. SKIP

CONSTRUCTION PHASE
  [ ] Functional Design ................ SKIP
  [ ] NFR Requirements ................. SKIP
  [ ] NFR Design ....................... SKIP
  [ ] Infrastructure Design ............ SKIP
  [ ] Code Generation .................. EXECUTE ← next
  [ ] Build and Test ................... EXECUTE

OPERATIONS PHASE
  [ ] Operations ....................... PLACEHOLDER
```

---

## Stage Decisions

### SKIP — User Stories
**Rationale**: Single user persona (Design Manager) clearly defined in PRD. No multi-stakeholder acceptance criteria needed. PRD section 4 (User Persona) + section 5 (User Flow) covers this fully.

### SKIP — Application Design
**Rationale**: Existing codebase has 6 units with well-established component patterns. New components follow the same page/component/API route structure. No new services or complex dependencies to design.

### SKIP — Units Generation
**Rationale**: Single unit. No decomposition needed.

### SKIP — Functional Design
**Rationale**: Requirements doc already defines the full data model (`excel_analyses` table), all metric calculations, insights engine behaviour, and edge cases. PRD is comprehensive enough to go straight to code.

### SKIP — NFR Requirements / NFR Design / Infrastructure Design
**Rationale**: Feature reuses the existing Next.js + Supabase + Claude stack entirely. NFRs are documented in requirements. One new Supabase table is the only infra change — no cloud resources, no deployment changes.

### EXECUTE — Code Generation
**Rationale**: Always executes. Full feature implementation.

### EXECUTE — Build and Test
**Rationale**: Always executes. Build instructions + test coverage for new unit.

---

## Code Generation Scope (Preview)

### New Files
| File | Purpose |
|---|---|
| `prisma/migrations/...` | Add `excel_analyses` table |
| `lib/excel/parser.ts` | XLSX/CSV file parsing + schema detection |
| `lib/excel/metrics.ts` | Metric computation (delivery, time, business, throughput) |
| `lib/excel/insights.ts` | Claude insights + recommendations generation |
| `app/api/insights/upload/route.ts` | Upload + analyse endpoint |
| `app/api/insights/list/route.ts` | List past analyses per user |
| `app/api/insights/[id]/route.ts` | Retrieve single analysis |
| `app/api/insights/export/route.ts` | CSV/Excel export |
| `app/(app)/insights/page.tsx` | Landing page (upload + history list) |
| `app/(app)/insights/[id]/page.tsx` | Dashboard view for a single analysis |
| `components/insights/FileUploader.tsx` | Drag & drop upload component |
| `components/insights/SchemaMapper.tsx` | Column mapping UI (ambiguous columns) |
| `components/insights/MetricsDashboard.tsx` | Dashboard with all metric panels |
| `components/insights/InsightCards.tsx` | AI insight cards |
| `components/insights/RecommendationCards.tsx` | Recommendations |
| `components/insights/ExportButton.tsx` | CSV/Excel export trigger |
| `components/insights/AnalysisHistory.tsx` | Past analyses list |
| `__tests__/insights/parser.test.ts` | Parser unit tests |
| `__tests__/insights/metrics.test.ts` | Metrics computation tests |
| `__tests__/insights/api.test.ts` | API route integration tests |

### Modified Files
| File | Change |
|---|---|
| Sidebar nav component | Add "Insights" nav item |
| `prisma/schema.prisma` | Add `ExcelAnalysis` model |

---

## Success Criteria

- File upload → dashboard rendered in < 10 seconds
- Schema auto-detection works for > 80% of standard Excel layouts
- Past analyses saved and retrievable per user
- CSV/Excel export works for all metric tables
- Zero raw file data stored in Supabase
- All new API routes covered by tests
