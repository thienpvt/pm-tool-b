---
phase: 21-portfolio-pm-dashboard-pages
plan: 02
subsystem: ui
tags: [react, vitest, dashboards, portfolio, filters, sonner]

requires:
  - phase: 21-portfolio-pm-dashboard-pages
    provides: Spec dashboard page shell, usePortfolioSpecDashboard GET hook, six KPI tiles
provides:
  - PortfolioFiltersBar with nine AND keys and Apply/Clear/Reset actions
  - saveFilters PUT and clearFilters POST on Phase 16 filter routes
  - refreshing vs initial loading distinction on filter refetch
  - In-page 401/403/5xx Copywriting panels without client authz layer
affects: [21-03, 21-04]

actuals:
  tokens: 42000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "PortfolioFiltersBar flex-wrap native selects h-8 with program/PM options from list"
    - "saveFilters/clearFilters PUT/POST then load(true) with refreshing not loading"
    - "ERROR_COPY centered panel with AlertTriangle; API is authz truth (D-09)"

key-files:
  created:
    - modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx
    - modules/dashboards/ui/portfolio/PortfolioFiltersBar.component.test.tsx
  modified:
    - modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts
    - modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx
    - modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx

key-decisions:
  - "Filter refetch sets refreshing only so KPI row stays visible during Apply (UI-SPEC loading portfolio-filter-bar)"
  - "Failed PUT/POST shows toast.error and skips load() so data.filters is not clobbered"
  - "403/401/5xx render in-page Copywriting; no redirect and no client role skip before GET (D-09)"

patterns-established:
  - "Pattern: filter bar derives program/PM options from payload.list unique customer_id and pm_user_id"
  - "Pattern: PortfolioDashboardError union in hook; page maps to UI-SPEC Copywriting Contract"

requirements-completed: [PDSH-07]

coverage:
  - id: D1
    description: "Apply filters PUTs AND keys then refetches dashboard GET"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx#Apply filters PUTs stage L2"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clear and Reset POST action clear/defaults then refetch GET"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx#Clear filters POSTs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Failed filter persist toasts Couldn't save filters — try again. and retains prior state"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx#shows toast.error"
        status: pass
    human_judgment: false
  - id: D4
    description: "401/403/5xx show UI-SPEC Copywriting in centered panel without KPI row"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx#shows 403 forbidden"
        status: pass
    human_judgment: false
  - id: D5
    description: "PortfolioFiltersBar renders all nine DASHBOARD_FILTER_KEYS controls"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioFiltersBar.component.test.tsx#renders all nine"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-28
status: complete
---

# Phase 21 Plan 02: Portfolio AND Filters Persist Summary

**Portfolio spec dashboard AND filters persist via Phase 16 PUT/POST routes with Apply/Clear/Reset chrome, refreshing refetch, and in-page 401/403/5xx Copywriting panels.**

## Performance

- **Duration:** 6 min
- **Tasks:** 3/3
- **Commits:** 4 (3 task + 1 docs)

## Accomplishments

- Created `PortfolioFiltersBar` with nine AND filter controls (native `h-8` selects/input), flex-wrap layout, and Apply/Clear/Reset buttons per UI-SPEC Copywriting Contract
- Extended `usePortfolioSpecDashboard` with `saveFilters` (PUT), `clearFilters` (POST clear|defaults), `refreshing` state, and typed error union
- Wired filter bar on `PortfolioDashboardPage`; filter-only refetch disables Apply without full-page loading spinner
- Added in-page error panels for 401/403/5xx with `AlertTriangle` icon — no redirect, no client role short-circuit (D-09)
- Component tests cover Apply PUT+GET, Clear/Reset POST, failed persist toast, and forbidden/error Copywriting strings

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| Task 1 (apply persist) | 6828f1d feat(21-02): portfolio filter apply persist | PASS |
| Task 2 (clear/reset/toast) | f796695 feat(21-02): filter clear defaults and save errors | PASS |
| Task 3 (error panels) | d1f5cfa feat(21-02): portfolio in-page forbidden and errors | PASS |

## Verification

```
npx vitest run --project jsdom modules/dashboards/ui/portfolio
→ 2 files, 18 tests passed
package.json / package-lock.json unchanged
```

## Self-Check: PASSED

- FOUND: modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx
- FOUND: modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts
- FOUND: modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx
- FOUND: 6828f1d, f796695, d1f5cfa

## Next

Ready for 21-03 (portfolio charts, project list, drill-down expansion).
