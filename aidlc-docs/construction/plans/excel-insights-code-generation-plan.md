# Code Generation Plan — AI Excel Insights Dashboard (Unit 7)

**Date**: 2026-03-19
**Unit**: excel-insights
**Stack**: Next.js (pages router) + Prisma + Supabase + Claude Sonnet + Tailwind

---

## Unit Context

- **Workspace root**: `/Users/saurabhbajaj/Desktop/testproject`
- **Project type**: Brownfield — Next.js `pages/` router
- **Auth pattern**: `withAuth` middleware, `Manager` model (managerId on all owned data)
- **AI pattern**: Handlers in `handlers/`, called from API routes
- **File parsing**: `xlsx` npm package (to be added)
- **No raw file storage** — parse in memory, store only computed results

---

## Step-by-Step Plan

### Step 1 — Add `xlsx` dependency
- [x] Add `xlsx` to `package.json` dependencies

### Step 2 — Prisma schema: Add `ExcelAnalysis` model
- [x] Modify `prisma/schema.prisma` — add `ExcelAnalysis` model + `ExcelAnalysisStatus` enum

### Step 3 — Prisma migration SQL
- [x] Create `prisma/migrations/add_excel_analyses/migration.sql`

### Step 4 — `lib/excel/parser.ts` — File parsing + schema detection
- [x]Parse `.xlsx` and `.csv` buffers using `xlsx`
- [x]Auto-detect standard columns (Item Name, Status, Size, Created Date, Completed Date, Revenue Impact)
- [x]Normalize status values (Done/Finished → Completed, etc.)
- [x]Return: rows, detectedSchema, unmappedColumns, sheetNames

### Step 5 — `lib/excel/metrics.ts` — Metric computation
- [x]Delivery metrics: count by status, size distribution, completion rate
- [x]Time metrics: avg turnaround time (overall + per size), delay detection
- [x]Business impact: total revenue, monthly revenue, revenue per item
- [x]Throughput: items completed per month, velocity trend
- [x]Quality signals: rework rate, iteration count (if columns present)

### Step 6 — `handlers/excelInsightsHandler.ts` — Claude insights + recommendations
- [x]Build prompt from parsed metrics + row sample
- [x]Call Claude claude-sonnet-4-6 to generate 3–7 ranked insights
- [x]Generate recommendations for missing columns
- [x]Return: `{ insights: string[], recommendations: string[] }`

### Step 7 — `pages/api/insights/upload.ts` — Upload + analyse endpoint
- [x]POST: accept multipart form data (file buffer)
- [x]Parse file in memory via `lib/excel/parser.ts`
- [x]If ambiguous columns → return `{ needsMapping: true, columns }`
- [x]Compute metrics via `lib/excel/metrics.ts`
- [x]Generate insights via `handlers/excelInsightsHandler.ts`
- [x]Save result to `ExcelAnalysis` in Prisma
- [x]Return full analysis result

### Step 8 — `pages/api/insights/index.ts` — List past analyses
- [x]GET: return all `ExcelAnalysis` rows for authenticated manager (newest first)
- [x]Include: id, filename, analysedAt, rowCount, sheetName (no full metrics for list)

### Step 9 — `pages/api/insights/[id].ts` — Get single analysis
- [x]GET: return full `ExcelAnalysis` record by id (verify managerId ownership)
- [x]DELETE: delete analysis record

### Step 10 — `pages/api/insights/export.ts` — CSV export
- [x]GET with `?id=`: fetch analysis from DB, convert metrics to CSV using `xlsx`
- [x]Return file download response (Content-Disposition: attachment)

### Step 11 — `components/insights/FileUploader.tsx`
- [x]Drag & drop + click-to-upload zone
- [x]Accept `.xlsx`, `.csv` only
- [x]Show filename + size preview on selection
- [x]Emit file to parent on selection
- [x]`data-testid` attributes on key elements

### Step 12 — `components/insights/SchemaMapper.tsx`
- [x]Shown when API returns `needsMapping: true`
- [x]Dropdown per standard field to map to detected columns
- [x]Submit mapped schema back to trigger analysis
- [x]`data-testid` attributes

### Step 13 — `components/insights/InsightCards.tsx`
- [x]Render array of insight strings as cards
- [x]Each card: insight text + rank indicator
- [x]Highlight key stat if detectable

### Step 14 — `components/insights/RecommendationCards.tsx`
- [x]Render array of recommendation strings
- [x]Only shown when recommendations exist

### Step 15 — `components/insights/MetricsDashboard.tsx`
- [x]Delivery metrics panel: status breakdown, size distribution, completion rate
- [x]Time metrics panel: avg turnaround, per-size breakdown
- [x]Business impact panel: total revenue, monthly revenue table, revenue/item
- [x]Throughput panel: monthly completion chart (simple table or bar)
- [x]Quality panel: shown only if data available

### Step 16 — `components/insights/ExportButton.tsx`
- [x]Button triggering GET `/api/insights/export?id=`
- [x]Triggers file download via browser

### Step 17 — `components/insights/AnalysisHistory.tsx`
- [x]List of past analyses (filename, date, row count)
- [x]Each row links to `/insights/[id]`
- [x]Empty state: "No analyses yet — upload your first Excel file"

### Step 18 — `pages/insights/index.tsx` — Landing page
- [x]FileUploader component
- [x]On upload: POST to `/api/insights/upload`, handle `needsMapping` flow
- [x]Show loading state during analysis
- [x]AnalysisHistory list below upload zone
- [x]On complete: redirect to `/insights/[id]`
- [x]Uses `AppLayout` + `withAuth`

### Step 19 — `pages/insights/[id].tsx` — Dashboard page
- [x]Fetch analysis via `/api/insights/[id]`
- [x]Render: InsightCards → MetricsDashboard → RecommendationCards
- [x]ExportButton in page header
- [x]Back link to `/insights`
- [x]Uses `AppLayout` + `withAuth`

### Step 20 — `components/layout/SideNav.tsx` — Add Insights nav item
- [x]Add `{ href: '/insights', label: 'Insights', icon: 'chart' }` to `navItems`
- [x]Add chart icon SVG to `NavIcon`

### Step 21 — `__tests__/insights/parser.test.ts`
- [x]Unit tests for schema detection (standard columns, fuzzy matching, missing columns)
- [x]Unit tests for status normalization
- [x]Unit tests for CSV + XLSX parsing

### Step 22 — `__tests__/insights/metrics.test.ts`
- [x]Unit tests for delivery metric computation
- [x]Unit tests for time metric computation (turnaround, delays)
- [x]Unit tests for business impact metrics
- [x]Unit tests for throughput + velocity

### Step 23 — `__tests__/insights/api-insights.test.ts`
- [x]Integration tests for upload endpoint (happy path, needsMapping, missing file)
- [x]Integration tests for list endpoint
- [x]Integration tests for get + delete by id
- [x]Integration tests for export endpoint

### Step 24 — `aidlc-docs/construction/excel-insights/code/code-summary.md`
- [x]Summary of all generated files with paths and purposes

---

## Files Overview

| # | File | Action |
|---|---|---|
| 1 | `package.json` | Modify — add xlsx |
| 2 | `prisma/schema.prisma` | Modify — add ExcelAnalysis model |
| 3 | `prisma/migrations/add_excel_analyses/migration.sql` | Create |
| 4 | `lib/excel/parser.ts` | Create |
| 5 | `lib/excel/metrics.ts` | Create |
| 6 | `handlers/excelInsightsHandler.ts` | Create |
| 7 | `pages/api/insights/upload.ts` | Create |
| 8 | `pages/api/insights/index.ts` | Create |
| 9 | `pages/api/insights/[id].ts` | Create |
| 10 | `pages/api/insights/export.ts` | Create |
| 11 | `components/insights/FileUploader.tsx` | Create |
| 12 | `components/insights/SchemaMapper.tsx` | Create |
| 13 | `components/insights/InsightCards.tsx` | Create |
| 14 | `components/insights/RecommendationCards.tsx` | Create |
| 15 | `components/insights/MetricsDashboard.tsx` | Create |
| 16 | `components/insights/ExportButton.tsx` | Create |
| 17 | `components/insights/AnalysisHistory.tsx` | Create |
| 18 | `pages/insights/index.tsx` | Create |
| 19 | `pages/insights/[id].tsx` | Create |
| 20 | `components/layout/SideNav.tsx` | Modify — add Insights item |
| 21 | `__tests__/insights/parser.test.ts` | Create |
| 22 | `__tests__/insights/metrics.test.ts` | Create |
| 23 | `__tests__/insights/api-insights.test.ts` | Create |
| 24 | `aidlc-docs/construction/excel-insights/code/code-summary.md` | Create |

**Total: 24 steps — 22 new files, 2 modified files**
