---
phase: 21-portfolio-pm-dashboard-pages
plan: 01
subsystem: ui
tags: [react, vitest, dashboards, portfolio, sidebar, nit-04]

requires:
  - phase: 16-portfolio-pm-dashboards
    provides: GET /api/dashboards/portfolio payload and PortfolioKpis contract
provides:
  - Wave 0 vitest modules/** glob
  - Spec dashboard module page with six KPI tiles
  - Thin app re-export at /dashboards/portfolio
  - Role-gated Sidebar Spec dashboard and My dashboard links
  - Shared dashboard payload types for portfolio and PM surfaces
affects: [21-02, 21-03, 21-04, phase-22, phase-24]

actuals:
  tokens: 48000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "modules/dashboards/ui/ with thin app/dashboards/* re-export"
    - "usePortfolioSpecDashboard hook consuming Phase 16 GET only"
    - "Role-gated Sidebar links without duplicate authz"

key-files:
  created:
    - modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx
    - modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts
    - modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx
    - modules/dashboards/ui/shared/types.ts
    - app/dashboards/portfolio/page.tsx
    - components/layout/Sidebar.dashboard-nav.component.test.tsx
  modified:
    - vitest.config.ts
    - components/layout/Sidebar.tsx

key-decisions:
  - "Split Sidebar NAV into primary (through Report) and secondary (Budget onward) with dashboard links inserted between"
  - "NIT-04 fiscal redirect footnote lives outside spec-kpi-row so KPI row test stays fiscal-free"

patterns-established:
  - "Pattern 1: thin app re-export from modules/dashboards/ui/"
  - "Pattern 2: usePortfolioSpecDashboard fetches /api/dashboards/portfolio only — not v1 /api/portfolio"

requirements-completed: [PDSH-07, NIT-04]

coverage:
  - id: D1
    description: "CPMO opens /dashboards/portfolio and sees six spec KPI tiles from mocked GET"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx#renders six KPI tiles"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sidebar exposes Spec dashboard (cpmo) and My dashboard (pm|cpmo) with role gates"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "components/layout/Sidebar.dashboard-nav.component.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "spec-kpi-row omits fiscal patterns per NIT-04"
    requirement: NIT-04
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx#omits fiscal patterns"
        status: pass
    human_judgment: false
  - id: D4
    description: "vitest jsdom collects modules/** component tests"
    requirement: PDSH-07
    verification:
      - kind: unit
        ref: "npx vitest run --project jsdom modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-28
status: complete
---

# Phase 21 Plan 01: Spec Dashboard KPI Tracer Summary

**Module-based Spec dashboard at `/dashboards/portfolio` with six Phase 16 KPI tiles, role-gated Sidebar links, and NIT-04 fiscal omission.**

## Performance

- **Duration:** 8 min
- **Tasks:** 3/3
- **Commits:** 7 (6 task + 1 docs)

## Accomplishments

- Extended `vitest.config.ts` so jsdom and node projects collect `modules/**` tests (Wave 0)
- Built `PortfolioDashboardPage` with loading shell, six KPI tiles bound to `PortfolioKpis`, and thin `app/dashboards/portfolio/page.tsx` re-export
- Added `usePortfolioSpecDashboard` hook fetching GET `/api/dashboards/portfolio` with 401/403/load_failed handling
- Inserted role-gated Sidebar links: Spec dashboard (`cpmo`) and My dashboard (`pm`|`cpmo`) after Portfolio Report
- Recorded NIT-04 with file comment, footnote outside KPI row, and regex component test
- Created `modules/dashboards/ui/shared/types.ts` with `PortfolioDashboardPayload` and `PmDashboardPayload`

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (tracer) | d070f81 test(21-01): red spec dashboard kpi tracer | PASS |
| GREEN (tracer) | 6100184 feat(21-01): spec dashboard kpi tracer | PASS |
| RED (sidebar) | 3dc9358 test(21-01): red sidebar spec and my dashboard nav | PASS |
| GREEN (sidebar) | 75a6815 feat(21-01): sidebar spec and my dashboard links | PASS |
| RED (NIT-04) | 75e9dfa test(21-01): red nit-04 kpi row omission | PASS |
| GREEN (NIT-04) | 2187e0e feat(21-01): nit-04 omission and shared types | PASS |

## Verification

```
npx vitest run --project jsdom modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx components/layout/Sidebar.dashboard-nav.component.test.tsx
→ 2 files, 10 tests passed
package.json / package-lock.json unchanged
```

## Self-Check: PASSED

- FOUND: modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx
- FOUND: app/dashboards/portfolio/page.tsx
- FOUND: modules/dashboards/ui/shared/types.ts
- FOUND: components/layout/Sidebar.dashboard-nav.component.test.tsx
- FOUND: d070f81, 6100184, 3dc9358, 75a6815, 75e9dfa, 2187e0e

## Next

Ready for 21-02 (portfolio filters and charts expansion).
