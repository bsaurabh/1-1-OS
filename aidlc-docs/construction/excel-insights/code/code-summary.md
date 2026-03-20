# Code Summary — AI Excel Insights Dashboard (Unit 7)

**Date**: 2026-03-19
**Status**: Complete

---

## Modified Files

| File | Change |
|---|---|
| `package.json` | Added `xlsx@^0.18.5` dependency |
| `prisma/schema.prisma` | Added `ExcelAnalysis` model, `ExcelAnalysisStatus` enum, relation on `Manager` |
| `components/layout/SideNav.tsx` | Added "Insights" nav item with chart icon |

---

## Created Files

### Database
| File | Purpose |
|---|---|
| `prisma/migrations/20260319_add_excel_analyses/migration.sql` | SQL to create `excel_analyses` table |

### Library — `lib/excel/`
| File | Purpose |
|---|---|
| `lib/excel/parser.ts` | XLSX/CSV buffer parsing, schema auto-detection, status normalisation, row mapping |
| `lib/excel/metrics.ts` | Delivery, time, business impact, throughput metric computation |

### Handler
| File | Purpose |
|---|---|
| `handlers/excelInsightsHandler.ts` | Claude claude-sonnet-4-6 call for insights + recommendations generation |

### API Routes — `pages/api/insights/`
| File | Purpose |
|---|---|
| `pages/api/insights/upload.ts` | POST — receive file, parse, compute, call Claude, save to DB |
| `pages/api/insights/index.ts` | GET — list past analyses for authenticated manager |
| `pages/api/insights/[id].ts` | GET / DELETE — fetch or remove a single analysis |
| `pages/api/insights/export.ts` | GET — generate and download multi-sheet .xlsx export |

### Components — `components/insights/`
| File | Purpose |
|---|---|
| `components/insights/FileUploader.tsx` | Drag-and-drop / click upload zone |
| `components/insights/SchemaMapper.tsx` | Manual column mapping UI (shown when auto-detection fails) |
| `components/insights/InsightCards.tsx` | Ranked AI insight cards |
| `components/insights/RecommendationCards.tsx` | Data improvement recommendation cards |
| `components/insights/MetricsDashboard.tsx` | Full metric panel (delivery, time, business, throughput) |
| `components/insights/ExportButton.tsx` | Triggers .xlsx export download |
| `components/insights/AnalysisHistory.tsx` | List of past analyses with links |

### Pages
| File | Purpose |
|---|---|
| `pages/insights/index.tsx` | Upload landing + history list |
| `pages/insights/[id].tsx` | Full dashboard view for a single analysis |

### Tests — `__tests__/insights/`
| File | Coverage |
|---|---|
| `__tests__/insights/parser.test.ts` | normaliseStatus, detectSchema, parseExcelBuffer (12 tests) |
| `__tests__/insights/metrics.test.ts` | delivery, time, business, throughput, computeMetrics (13 tests) |
| `__tests__/insights/api-insights.test.ts` | list, get, delete endpoints (7 tests) |

---

## Key Design Decisions

- **In-memory only**: Uploaded files are never stored; only computed metrics + insights saved in Supabase
- **Insight-first UI**: InsightCards render above MetricsDashboard per UX principles
- **Graceful degradation**: SchemaMapper shown when auto-detection fails rather than blocking
- **Additive**: Zero changes to existing Units 1–6 logic or routes
