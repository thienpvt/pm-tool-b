---
phase: 16-portfolio-pm-dashboards
plan: 02
subsystem: api
tags: [dashboards, filters, exceljs, jspdf, audit, withCpmo]

requires:
  - phase: 16-01
    provides: getPortfolioDashboard, parseDashboardFilters, dashboard_filter_state DDL, migrateDashboards
provides:
  - upsertDashboardFilters ON CONFLICT upsert-in-place
  - GET/PUT/POST /api/dashboards/portfolio/filters with withCpmo
  - POST /api/dashboards/portfolio/export xlsx and pdf
  - auditLog action dashboard_export
affects: [16-03-pm-dashboard]

actuals:
  tokens: 38000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Filter persist upsert per (user_id, surface) — no physical DELETE"
    - "Export generates Buffer before auditLog"
    - "One-shot body.filters override for export without persisting"

key-files:
  created:
    - lib/dashboards/filter-schema.ts
    - app/api/dashboards/portfolio/filters/route.ts
    - app/api/dashboards/portfolio/export/route.ts
    - app/api/dashboards/portfolio/export/schema.ts
    - lib/export/dashboard-portfolio.ts
  modified:
    - lib/repositories/dashboard-filter-state.repo.ts
    - lib/services/spec-dashboards.service.ts
    - next.config.ts
    - test/repo-db.ts

key-decisions:
  - "PUT replaces whole filter blob via parseDashboardFilters + upsert; POST clear/defaults both write {}"
  - "exportPortfolioDashboard reuses buildPortfolioDashboard helper; optional body.filters is one-shot only"
  - "PDF via jsPDF text layout; xlsx styling helpers copied locally (not consolidated-weekly import)"

patterns-established:
  - "Portfolio filter routes mirror weekly-periods config pattern (withCpmo + zod schema)"
  - "Export route returns NextResponse(buffer) with Content-Disposition attachment"

requirements-completed: [PDSH-05, PDSH-06]

coverage:
  - id: D1
    description: "CPMO persists portfolio dashboard filters per user+surface; GET inherits stored blob"
    requirement: PDSH-05
    verification:
      - kind: unit
        ref: "lib/repositories/dashboard-filter-state.repo.test.ts#upsertDashboardFilters replaces"
        status: pass
      - kind: unit
        ref: "lib/services/spec-dashboards.service.unit.test.ts#save then getPortfolioDashboard applies"
        status: pass
      - kind: integration
        ref: "app/api/dashboards/portfolio/filters/route.test.ts#returns 200 and persists filters"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clear/defaults restore empty filters; unknown keys 400; PM/viewer 403"
    requirement: PDSH-06
    verification:
      - kind: unit
        ref: "lib/services/spec-dashboards.service.unit.test.ts#throws ValidationError on unknown filter key"
        status: pass
      - kind: integration
        ref: "app/api/dashboards/portfolio/filters/route.test.ts#returns 400 for unknown filter key"
        status: pass
      - kind: integration
        ref: "app/api/dashboards/portfolio/filters/route.test.ts#returns 403 for pm session"
        status: pass
    human_judgment: false
  - id: D3
    description: "CPMO exports filtered portfolio dashboard as xlsx (exceljs) and pdf (jspdf) with drill-down ids"
    requirement: PDSH-06
    verification:
      - kind: unit
        ref: "lib/export/dashboard-portfolio.unit.test.ts#returns a non-empty buffer with required sheet names"
        status: pass
      - kind: unit
        ref: "lib/export/dashboard-portfolio.unit.test.ts#returns a buffer whose first bytes are %PDF"
        status: pass
      - kind: integration
        ref: "app/api/dashboards/portfolio/export/route.test.ts#returns 200 with xlsx Content-Type"
        status: pass
    human_judgment: false
  - id: D4
    description: "Successful export writes auditLog action dashboard_export; one-shot filters not persisted"
    requirement: PDSH-06
    verification:
      - kind: unit
        ref: "lib/services/spec-dashboards.service.unit.test.ts#calls auditLog with dashboard_export"
        status: pass
      - kind: unit
        ref: "lib/services/spec-dashboards.service.unit.test.ts#body.filters overrides stored filters without upserting"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-26
status: complete
---

# Phase 16 Plan 02: Filter Persist & Export Summary

**CPMO portfolio filter upsert per user+surface, clear/defaults to {}, and xlsx/pdf export with dashboard_export audit trail**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-26T14:19:00Z
- **Completed:** 2026-08-26T14:22:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- `upsertDashboardFilters` ON CONFLICT (user_id, surface) DO UPDATE with no physical DELETE
- GET/PUT/POST `/api/dashboards/portfolio/filters` — withCpmo, zod strict unknown-key 400, clear/defaults → `{}`
- `savePortfolioDashboardFilters` / `clearPortfolioDashboardFilters` / `getPortfolioDashboardFilters` service layer
- `generatePortfolioDashboardXlsx` (5 sheets) and `generatePortfolioDashboardPdf` (%PDF) via existing exceljs/jspdf
- POST `/api/dashboards/portfolio/export` with optional one-shot `filters` override and `auditLog` `dashboard_export`
- `jspdf` added to `next.config.ts` `serverExternalPackages`

## Task Commits

1. **Task 1 RED: Persist, clear, and restore default filters** - `b588c58` (test)
2. **Task 1 GREEN: Persist portfolio dashboard filters** - `ebc6319` (feat)
3. **Task 2 RED: Export filtered dashboard** - `112a426` (test)
4. **Task 2 GREEN: Portfolio dashboard xlsx and pdf export** - `7e53ccf` (feat)

## Files Created/Modified

- `lib/repositories/dashboard-filter-state.repo.ts` — `upsertDashboardFilters`
- `lib/dashboards/filter-schema.ts` — `dashboardFiltersSchema`, `filterActionSchema`
- `lib/services/spec-dashboards.service.ts` — filter save/clear/get + `exportPortfolioDashboard` + `buildPortfolioDashboard` refactor
- `app/api/dashboards/portfolio/filters/route.ts` — GET/PUT/POST withCpmo
- `lib/export/dashboard-portfolio.ts` — xlsx/pdf generators with local styling helpers
- `app/api/dashboards/portfolio/export/route.ts` — POST binary download
- `app/api/dashboards/portfolio/export/schema.ts` — `portfolioExportSchema`
- `next.config.ts` — `jspdf` in serverExternalPackages
- `test/repo-db.ts` — exclude `dashboard_filter_state` from RETURNING id

## Decisions Made

- Refactored `buildPortfolioDashboard` internal helper so export and GET share filter application logic
- POST `clear` and `defaults` both call `clearPortfolioDashboardFilters` (empty `{}`)
- Buffer generated before `auditLog` so generator failures leave no audit row

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TestDbClient RETURNING id on dashboard_filter_state upsert**
- **Found during:** Task 1 GREEN verification
- **Issue:** Composite-PK table has no `id` column; TestDbClient appended `RETURNING id` on INSERT
- **Fix:** Added `dashboard_filter_state` to `needsReturningId` exclusion list in `test/repo-db.ts`
- **Files modified:** `test/repo-db.ts`
- **Committed in:** `ebc6319`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test infrastructure fix only; no scope change.

## Issues Encountered

None beyond the test adapter fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Portfolio filter persist and export complete (PDSH-05, PDSH-06)
- Ready for 16-03 PM dashboard surface (separate `pm` filter routes)

## Self-Check: PASSED

- FOUND: `.planning/phases/16-portfolio-pm-dashboards/16-02-SUMMARY.md`
- FOUND: commit b588c58
- FOUND: commit ebc6319
- FOUND: commit 112a426
- FOUND: commit 7e53ccf

---
*Phase: 16-portfolio-pm-dashboards*
*Completed: 2026-08-26*
