---
phase: 21-portfolio-pm-dashboard-pages
plan: 04
subsystem: ui
tags: [react, vitest, dashboards, pm, filters, action-queues]

requires:
  - phase: 21-portfolio-pm-dashboard-pages
    provides: Shared dashboard types, Sidebar My dashboard link, portfolio filter bar pattern
  - phase: 16-portfolio-pm-dashboards
    provides: GET /api/dashboards/pm payload with server hrefs and pm filter routes
provides:
  - PM dashboard at /dashboards/pm with weekly, milestone, and RAID action queues
  - usePmDashboard hook with GET, filter persist, and visibility refetch
  - PmFiltersBar with nine AND keys scoped to assigned projects
  - In-page 401/403/5xx panels matching portfolio Copywriting
affects: [phase-22, phase-24]

actuals:
  tokens: 38000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "PmActionQueues render Link href={row.href} only — no client-built deep links (D-10)"
    - "usePmDashboard visibilitychange refetch for live queue updates after deep links (D-11)"
    - "PmFiltersBar mirrors portfolio AND keys against /api/dashboards/pm/filters (D-13)"

key-files:
  created:
    - app/dashboards/pm/page.tsx
    - modules/dashboards/ui/pm/PmDashboardPage.tsx
    - modules/dashboards/ui/pm/usePmDashboard.ts
    - modules/dashboards/ui/pm/PmActionQueues.tsx
    - modules/dashboards/ui/pm/PmFiltersBar.tsx
    - modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx
  modified: []

key-decisions:
  - "PmFiltersBar duplicated from PortfolioFiltersBar with pm-filter-bar test id — same nine keys, different API surface"
  - "Filter refetch sets refreshing only so queue tables stay visible during Apply"
  - "No client assignment filter — GET /api/dashboards/pm is the scope truth (D-12)"

patterns-established:
  - "Pattern: PM queue action links use server href verbatim (Open report / View milestone / View RAID)"
  - "Pattern: visibilitychange visible triggers load(true) without full-page spinner"

requirements-completed: [MDSH-06]

coverage:
  - id: D1
    description: "Assigned PM opens /dashboards/pm and sees three action queues with server href links"
    requirement: MDSH-06
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx#renders My dashboard title and queue links"
        status: pass
    human_judgment: false
  - id: D2
    description: "Empty weekly/milestones/raid queues show Copywriting headings with table headers visible"
    requirement: MDSH-06
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx#shows empty queue copy"
        status: pass
    human_judgment: false
  - id: D3
    description: "PM filters persist via PUT/POST /api/dashboards/pm/filters with Apply disabled during refetch"
    requirement: MDSH-06
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx#Apply filters PUTs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Returning to tab refetches GET /api/dashboards/pm on visibilitychange visible"
    requirement: MDSH-06
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx#refetches GET when document becomes visible"
        status: pass
    human_judgment: false
  - id: D5
    description: "401/403/5xx show in-page Copywriting without redirect"
    requirement: MDSH-06
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx#shows 403 forbidden"
        status: pass
    human_judgment: false
  - id: D6
    description: "Mixed weekly draft/not_submitted rows render status and overdue badges"
    requirement: MDSH-06
    verification:
      - kind: unit
        ref: "modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx#renders mixed weekly statuses"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-08-28
status: complete
---

# Phase 21 Plan 04: PM Action Dashboard Summary

**My dashboard at `/dashboards/pm` with weekly, milestone, and RAID queues deep-linking via server hrefs, AND filters, and live refetch on tab focus.**

## Performance

- **Duration:** 4 min
- **Tasks:** 3/3
- **Commits:** 4 (3 task + 1 docs)

## Accomplishments

- Built `PmDashboardPage` shell with "My dashboard" title, loading spinner, and three `PmActionQueues` Card sections
- `usePmDashboard` fetches GET `/api/dashboards/pm` with 401/403/load_failed mapping; PUT/POST filter persist; `visibilitychange` refetch (D-11)
- Queue rows use `<Link href={row.href}>` with Copywriting labels Open report / View milestone / View RAID (D-10)
- `PmFiltersBar` with nine AND keys, Apply/Clear/Reset, and failed persist toast
- Thin `app/dashboards/pm/page.tsx` re-export (D-01, D-02)
- 15 component tests covering queues, empty states, filters, visibility refetch, errors, and mixed weekly statuses

## Task Commits

1. **Task 1: End-to-end My dashboard queues with server hrefs** - `5fe09dd` (feat)
2. **Task 2: PM AND filters and live refetch on focus** - `d7a1065` (feat)
3. **Task 3: PM 401/403/5xx panels and mixed weekly statuses** - `e5744fe` (feat)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| Task 1 (queues + re-export) | 5fe09dd feat(21-04): pm dashboard queues and re-export | PASS |
| Task 2 (filters + visibility) | d7a1065 feat(21-04): pm filters and visibility refetch | PASS |
| Task 3 (errors + mixed weekly) | e5744fe feat(21-04): pm forbidden and mixed weekly rows | PASS |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

```
npx vitest run --project jsdom modules/dashboards/ui/pm
→ 1 file, 15 tests passed
package.json / package-lock.json unchanged
```

## Self-Check: PASSED

- FOUND: app/dashboards/pm/page.tsx
- FOUND: modules/dashboards/ui/pm/PmDashboardPage.tsx
- FOUND: modules/dashboards/ui/pm/usePmDashboard.ts
- FOUND: modules/dashboards/ui/pm/PmActionQueues.tsx
- FOUND: modules/dashboards/ui/pm/PmFiltersBar.tsx
- FOUND: modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx
- FOUND: 5fe09dd, d7a1065, e5744fe

## Next

Phase 21 plan 03 (portfolio charts/list expansion) may run in parallel; PM dashboard is complete for MDSH-06.
