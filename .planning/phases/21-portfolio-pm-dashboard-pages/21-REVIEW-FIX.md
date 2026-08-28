---
phase: 21-portfolio-pm-dashboard-pages
fixed_at: 2026-08-28T09:07:00Z
review_path: .planning/phases/21-portfolio-pm-dashboard-pages/21-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 1
status: all_fixed
---

# Phase 21: Code Review Fix Report

**Fixed at:** 2026-08-28T09:07:00Z  
**Source review:** `.planning/phases/21-portfolio-pm-dashboard-pages/21-REVIEW.md`  
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 1 (WR-05 WONTFIX — shared filter bar extraction deferred)

**Verification:** Component tests ran in the main checkout (`vitest run` on portfolio and PM dashboard page tests; 44 passed). No isolated worktree was used (`workflow.use_worktrees=false` / sequential main-tree mode).

## Fixed Issues

### CR-01: Network/parse failures render blank page (no error state)

**Files modified:** `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts`, `modules/dashboards/ui/pm/usePmDashboard.ts`, `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx`, `modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx`  
**Commit:** `25b9b76`  
**Applied fix:** Added `catch` blocks to both `load()` implementations to set `error` to `load_failed` and clear `data`. Added component tests stubbing `fetch` with `Promise.reject(new Error('network'))` and asserting error copy renders.

### WR-01: Third font weight violates UI-SPEC typography contract

**Files modified:** `modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx`, `modules/dashboards/ui/portfolio/PortfolioDrilldownTable.tsx`  
**Commits:** `10daaf3`, `1aff2e7`  
**Applied fix:** Replaced `font-medium` with `font-semibold` on empty-state headings in the project table and drill-down panel.

### WR-02: Portfolio header missing filter-summary subtitle

**Files modified:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx`  
**Commit:** `33b4313`  
**Applied fix:** Added muted subtitle showing `{data.list.length} project(s) matching filters` under the Spec dashboard title. Subtitle covered by component test in CR-01 commit (`PortfolioDashboardPage.component.test.tsx`).

### WR-03: Drill-down panel crashes if API returns null/undefined rows

**Files modified:** `modules/dashboards/ui/portfolio/PortfolioDrilldownTable.tsx`  
**Commit:** `1aff2e7`  
**Applied fix:** Default drill-down rows with `(drilldowns[activeKey] ?? [])` before accessing `.length`.

### WR-04: Export path lacks catch for network/blob failures

**Files modified:** `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts`, `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx`  
**Commit:** `25b9b76`  
**Applied fix:** Added `catch { toast.error('Export failed — try again.'); }` to `exportDashboard`. Added component test stubbing export `fetch` to reject and asserting error toast (included in CR-01 commit because both changes touched the same hook and test file).

## Skipped Issues

### WR-05: ~240 lines duplicated between filter bars

**File:** `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx`, `modules/dashboards/ui/pm/PmFiltersBar.tsx`  
**Reason:** WONTFIX — extracting a shared filter bar component is out of scope for this phase; deferred to a future refactor.

---

_Fixed: 2026-08-28T09:07:00Z_  
_Fixer: Claude (gsd-code-fixer)_  
_Iteration: 1_
