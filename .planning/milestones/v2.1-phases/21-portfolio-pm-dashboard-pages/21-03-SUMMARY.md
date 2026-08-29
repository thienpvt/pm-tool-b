---
phase: 21-portfolio-pm-dashboard-pages
plan: 03
subsystem: ui
tags: [react, vitest, dashboards, portfolio, charts, export, drill-down]

requires:
  - phase: 21-portfolio-pm-dashboard-pages
    provides: Spec dashboard page shell, filters, usePortfolioSpecDashboard GET hook
provides:
  - PortfolioKpiTiles extracted with three clickable drill-down keys
  - PortfolioDrilldownTable with id-based deep links and empty copy
  - PortfolioCharts CSS stage/RAG bars from GET charts
  - PortfolioProjectTable filtered project list with RAG badges
  - downloadBlob helper and exportDashboard POST blob download
affects: [21-04]

actuals:
  tokens: 10000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "PortfolioKpiTiles activeKey toggle collapses drill-down panel"
    - "CSS horizontal bars for charts.by_stage / charts.by_rag — no chart npm package"
    - "exportDashboard POST /api/dashboards/portfolio/export + downloadBlob revokeObjectURL"

key-files:
  created:
    - modules/dashboards/ui/portfolio/PortfolioKpiTiles.tsx
    - modules/dashboards/ui/portfolio/PortfolioDrilldownTable.tsx
    - modules/dashboards/ui/portfolio/PortfolioCharts.tsx
    - modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx
    - modules/dashboards/ui/shared/downloadBlob.ts
    - modules/dashboards/ui/portfolio/PortfolioKpiTiles.component.test.tsx
    - modules/dashboards/ui/portfolio/PortfolioCharts.component.test.tsx
    - modules/dashboards/ui/shared/downloadBlob.test.ts
  modified:
    - modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx
    - modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts
    - modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx

key-decisions:
  - "Drill-down data from initial GET payload only — no separate fetch (UI-SPEC loading drill-down)"
  - "CSS bars with width percent = count / max(counts, 1) instead of recharts in modules/dashboards/ui"
  - "Export buttons stay enabled when list is empty; disabled only while POST in-flight"

patterns-established:
  - "Pattern: PortfolioDrilldownTable links only when project_id present — omit when missing (D-07)"
  - "Pattern: downloadBlob createObjectURL → anchor click → revokeObjectURL (D-08)"

requirements-completed: [PDSH-07, NIT-04]

coverage:
  - id: D1
    description: "Clickable Overdue/High RAID/Tech council tiles open matching drill-down with toggle collapse"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioKpiTiles.component.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Drill-down rows deep-link via project_id; omit link when id missing"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx#omits milestone link"
        status: pass
    human_judgment: false
  - id: D3
    description: "CSS By stage L0-L5 and By RAG green/amber/red bars always render"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioCharts.component.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Project list columns with empty copy and name link truncate/title"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx#empty project list"
        status: pass
    human_judgment: false
  - id: D5
    description: "Export Excel/PDF POST blob download with toast success/error"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx#POSTs xlsx export"
        status: pass
    human_judgment: false
  - id: D6
    description: "downloadBlob always calls revokeObjectURL after click"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/shared/downloadBlob.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "spec-kpi-row omits fiscal patterns per NIT-04 after tile extract"
    requirement: NIT-04
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioKpiTiles.component.test.tsx#omits fiscal"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-28
status: complete
---

# Phase 21 Plan 03: Charts, Drill-downs, List, Export Summary

**Spec portfolio dashboard shows CSS stage/RAG charts, filtered project table, KPI tile drill-downs with id-based links, and server xlsx/pdf export via downloadBlob.**

## Performance

- **Duration:** 12 min
- **Tasks:** 3/3
- **Commits:** 7 (6 task + 1 docs pending)

## Accomplishments

- Extracted `PortfolioKpiTiles` with three clickable drill-down keys; toggle collapse; NIT-04 fiscal omission preserved on `spec-kpi-row`
- Added `PortfolioDrilldownTable` with empty copy, truncate/title on long names, and id-based Links to milestones/RAID routes
- Built `PortfolioCharts` with CSS horizontal bars for L0–L5 stage and green/amber/red RAG — no chart library import
- Created `PortfolioProjectTable` with eight columns, RAG Badge semantic tokens, and empty list copy spanning columns
- Added `downloadBlob` utility and `exportDashboard` in hook POSTing `/api/dashboards/portfolio/export` with toast feedback
- Header Export Excel / Export PDF buttons disable while in-flight; remain enabled when list is empty

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] downloadBlob test needed jsdom environment**
- **Found during:** Task 3
- **Issue:** `downloadBlob.test.ts` ran in node project where `document` is undefined
- **Fix:** Added `// @vitest-environment jsdom` directive to test file
- **Files modified:** modules/dashboards/ui/shared/downloadBlob.test.ts
- **Commit:** c86f405

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (kpi drill-down) | e152c66 test(21-03): red kpi drill-down panel | PASS |
| GREEN (kpi drill-down) | 65213ef feat(21-03): kpi drill-down panel | PASS |
| RED (css charts) | 3863969 test(21-03): red css stage and rag charts | PASS |
| GREEN (css charts) | a3fcffd feat(21-03): css stage and rag charts | PASS |
| RED (table export) | c86f405 test(21-03): red project table and export download | PASS |
| GREEN (table export) | 7a4cd40 feat(21-03): project table and export download | PASS |

## Verification

```
npx vitest run modules/dashboards/ui/portfolio modules/dashboards/ui/shared/downloadBlob.test.ts
→ 5 files, 42 tests passed
package.json / package-lock.json unchanged
```

## Self-Check: PASSED

- FOUND: modules/dashboards/ui/portfolio/PortfolioKpiTiles.tsx
- FOUND: modules/dashboards/ui/portfolio/PortfolioCharts.tsx
- FOUND: modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx
- FOUND: modules/dashboards/ui/shared/downloadBlob.ts
- FOUND: e152c66, 65213ef, 3863969, a3fcffd, c86f405, 7a4cd40

## Next

Phase 21 plan 04 (PM action dashboard) was already complete when this plan executed; portfolio spec surface is feature-complete for PDSH-07.
