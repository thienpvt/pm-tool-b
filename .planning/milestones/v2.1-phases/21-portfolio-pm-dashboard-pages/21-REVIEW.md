---
phase: 21-portfolio-pm-dashboard-pages
reviewed: 2026-08-28T09:09:00Z
re_reviewed: 2026-08-28T09:09:00Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - modules/dashboards/ui/shared/types.ts
  - modules/dashboards/ui/shared/downloadBlob.ts
  - modules/dashboards/ui/shared/downloadBlob.test.ts
  - modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts
  - modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx
  - modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx
  - modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx
  - modules/dashboards/ui/portfolio/PortfolioFiltersBar.component.test.tsx
  - modules/dashboards/ui/portfolio/PortfolioKpiTiles.tsx
  - modules/dashboards/ui/portfolio/PortfolioKpiTiles.component.test.tsx
  - modules/dashboards/ui/portfolio/PortfolioCharts.tsx
  - modules/dashboards/ui/portfolio/PortfolioCharts.component.test.tsx
  - modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx
  - modules/dashboards/ui/portfolio/PortfolioDrilldownTable.tsx
  - modules/dashboards/ui/pm/usePmDashboard.ts
  - modules/dashboards/ui/pm/PmDashboardPage.tsx
  - modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx
  - modules/dashboards/ui/pm/PmFiltersBar.tsx
  - modules/dashboards/ui/pm/PmActionQueues.tsx
  - app/dashboards/portfolio/page.tsx
  - app/dashboards/pm/page.tsx
  - components/layout/Sidebar.tsx
  - components/layout/Sidebar.dashboard-nav.component.test.tsx
  - vitest.config.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
fix_iteration: 1
fix_report: 21-REVIEW-FIX.md
---

# Phase 21: Code Review Report

**Reviewed:** 2026-08-28T09:02:00Z  
**Re-reviewed:** 2026-08-28T09:09:00Z (post-fix)  
**Depth:** deep  
**Files Reviewed:** 24  
**Status:** clean

## Summary

Initial deep review found one blocker (CR-01) and five warnings. Fix iteration 1 (`21-REVIEW-FIX.md`) resolved CR-01 and WR-01 through WR-04. WR-05 (duplicated filter bars) accepted as WONTFIX — deferred to future refactor.

Re-review verified all in-scope fixes in source:

| Finding | Status | Verification |
|---------|--------|--------------|
| CR-01 | Fixed | `catch` blocks in both hooks set `load_failed`; network-rejection tests in page component tests |
| WR-01 | Fixed | `font-semibold` replaces `font-medium` in empty-state headings |
| WR-02 | Fixed | Portfolio header subtitle shows `{data.list.length} project(s) matching filters` |
| WR-03 | Fixed | `(drilldowns[activeKey] ?? [])` guards null/undefined rows |
| WR-04 | Fixed | `exportDashboard` catch shows export-failure toast; test covers rejected fetch |
| WR-05 | WONTFIX | Shared filter bar extraction deferred |

No remaining blockers. Two info-level suggestions (IN-01, IN-02) remain optional.

## Resolved Issues (initial review)

<details>
<summary>CR-01: Network/parse failures render blank page — FIXED</summary>

**File:** `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts:44-46`, `modules/dashboards/ui/pm/usePmDashboard.ts:41-43`

Both `load()` implementations now catch fetch/JSON failures and set `error` to `load_failed`. Component tests assert error copy on `Promise.reject(new Error('network'))`.
</details>

<details>
<summary>WR-01 through WR-04 — FIXED (see 21-REVIEW-FIX.md)</summary>

Typography, portfolio subtitle, drill-down null guard, and export catch all verified in source.
</details>

<details>
<summary>WR-05: Duplicated filter bars — WONTFIX (accepted)</summary>

Shared extraction deferred; not blocking ship.
</details>

## Info (unchanged, optional)

### IN-01: Loose drill-down typing masks schema mismatches

**File:** `modules/dashboards/ui/shared/types.ts:12-16`  
**Fix:** Define `PortfolioDrilldownRows` discriminated by key.

### IN-02: downloadBlob revokes object URL synchronously

**File:** `modules/dashboards/ui/shared/downloadBlob.ts:6-7`  
**Fix:** Defer revocation with `setTimeout(() => URL.revokeObjectURL(url), 0)`.

---

_Reviewed: 2026-08-28T09:02:00Z_  
_Re-reviewed: 2026-08-28T09:09:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
