---
phase: 16-portfolio-pm-dashboards
plan: 03
subsystem: api
tags: [dashboards, pm, weekly-reports, milestones, raid, withAuth]

requires:
  - phase: 16-02
    provides: upsertDashboardFilters, parseDashboardFilters, dashboardFiltersSchema, filterActionSchema
provides:
  - resolveCurrentPeriod and isDueInUpcomingOrOverdue helpers
  - getPmDashboard with assignment-scoped projects and action queues
  - GET /api/dashboards/pm with withAuth pm|cpmo gate
  - GET/PUT/POST /api/dashboards/pm/filters on surface pm
affects: [16-04-ui]

actuals:
  tokens: 11000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "PM dashboard uses listProjects(companyId, { pmUserId }) — CPMO on PM route still own assignments"
    - "Weekly actions via listPeriodShellsRepo + isWeeklyReportOverdue; never getPeriodTracking"
    - "Milestone union with overdue winning; RAID filtered by isDueInUpcomingOrOverdue + tech-council flag"
    - "PM filter routes use withAuth not withCpmo"

key-files:
  created:
    - lib/dashboards/period-resolver.ts
    - lib/dashboards/period-resolver.unit.test.ts
    - app/api/dashboards/pm/route.ts
    - app/api/dashboards/pm/route.test.ts
    - app/api/dashboards/pm/filters/route.ts
    - app/api/dashboards/pm/filters/route.test.ts
  modified:
    - lib/services/spec-dashboards.service.ts
    - lib/services/spec-dashboards.service.unit.test.ts

key-decisions:
  - "Shared enrichProjectListRows helper between portfolio and PM dashboards for identical list row shape"
  - "assertPmDashboardActor centralizes pm|cpmo + non-null company_id checks in service layer"
  - "RAID action window copied addUtcDays locally in period-resolver (not imported from raid-masters)"

patterns-established:
  - "PM GET route mirrors portfolio auth matrix inverted: pm/cpmo 200, viewer 403, null company 403"
  - "Live read — second getPmDashboard after shell submitted omits weekly row (no cache)"

requirements-completed: [MDSH-01, MDSH-02, MDSH-03, MDSH-04, MDSH-05]

coverage:
  - id: D1
    description: "PM list scoped to assignment window via listProjects pmUserId with portfolio list fields"
    requirement: MDSH-01
    verification:
      - kind: unit
        ref: "lib/services/spec-dashboards.service.unit.test.ts#calls listProjects with pmUserId"
        status: pass
      - kind: integration
        ref: "app/api/dashboards/pm/route.test.ts#returns 200 for pm session"
        status: pass
    human_judgment: false
  - id: D2
    description: "Weekly actions from listPeriodShellsRepo for not_submitted/draft with overdue and href"
    requirement: MDSH-02
    verification:
      - kind: unit
        ref: "lib/services/spec-dashboards.service.unit.test.ts#maps not_submitted and draft shells"
        status: pass
      - kind: unit
        ref: "lib/services/spec-dashboards.service.unit.test.ts#does not import weekly-tracking.service"
        status: pass
    human_judgment: false
  - id: D3
    description: "Milestone actions union upcoming and overdue on assigned projects with href"
    requirement: MDSH-03
    verification:
      - kind: unit
        ref: "lib/services/spec-dashboards.service.unit.test.ts#unions upcoming and overdue milestones"
        status: pass
    human_judgment: false
  - id: D4
    description: "High RAID upcoming/overdue actions with tech-council flag and href"
    requirement: MDSH-04
    verification:
      - kind: unit
        ref: "lib/services/spec-dashboards.service.unit.test.ts#includes High RAID records"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live GET omits resolved weekly rows; PM filters persist on surface pm"
    requirement: MDSH-05
    verification:
      - kind: unit
        ref: "lib/services/spec-dashboards.service.unit.test.ts#omits weekly action on second GET"
        status: pass
      - kind: integration
        ref: "app/api/dashboards/pm/filters/route.test.ts#returns 200 and persists filters for pm"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-26
status: complete
---

# Phase 16 Plan 03: PM Dashboard Summary

**Assignment-scoped PM dashboard with weekly/milestone/RAID action queues, deep-link hrefs, live refresh, and pm-surface filter persist via withAuth**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-26T14:24:00Z
- **Completed:** 2026-08-26T14:27:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `resolveCurrentPeriod` and `isDueInUpcomingOrOverdue` in `lib/dashboards/period-resolver.ts`
- `getPmDashboard` returns filtered assigned projects plus `actions.weekly|milestones|raid` with href strings
- GET `/api/dashboards/pm` — withAuth, pm|cpmo 200, viewer/null-company 403
- GET/PUT/POST `/api/dashboards/pm/filters` — withAuth, surface `pm`, reuses 16-02 filter schemas
- 46 Vitest tests green across period-resolver, service, and route layers

## Task Commits

1. **Task 1 RED: PM assignment list and weekly action queue** - `5d809f8` (test)
2. **Task 1 GREEN: PM dashboard assignment list and weekly queue** - `cce30c9` (feat)
3. **Task 2 RED: Milestone and RAID actions, live refresh, PM filters** - `adcdc2f` (test)
4. **Task 2 GREEN: PM milestone RAID actions and pm filters** - `6fc2a1c` (feat)

## Files Created/Modified

- `lib/dashboards/period-resolver.ts` — current period resolver + RAID due-date window helper
- `lib/services/spec-dashboards.service.ts` — `getPmDashboard`, PM filter save/clear/get
- `app/api/dashboards/pm/route.ts` — GET withAuth pm|cpmo dashboard
- `app/api/dashboards/pm/filters/route.ts` — GET/PUT/POST withAuth pm filters
- Unit/route tests for all of the above

## Decisions Made

- Extracted `enrichProjectListRows` from portfolio builder so PM list rows match portfolio shape
- Service-layer `assertPmDashboardActor` shared by dashboard GET and filter mutations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] access mock missing hasRole for getPmDashboard tests**
- **Found during:** Task 1 GREEN verification
- **Issue:** Partial mock of `@/lib/services/access` omitted `hasRole`, breaking PM dashboard unit tests
- **Fix:** Switched to `importOriginal` pattern preserving real `hasRole`
- **Files modified:** `lib/services/spec-dashboards.service.unit.test.ts`
- **Committed in:** `cce30c9`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test infrastructure fix only; no scope change.

## Issues Encountered

None beyond the access mock fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PM dashboard API complete (MDSH-01..05)
- Ready for optional UI consumption or Phase 16 verification wave

## Self-Check: PASSED

- FOUND: `.planning/phases/16-portfolio-pm-dashboards/16-03-SUMMARY.md`
- FOUND: commit 5d809f8
- FOUND: commit cce30c9
- FOUND: commit adcdc2f
- FOUND: commit 6fc2a1c

---
*Phase: 16-portfolio-pm-dashboards*
*Completed: 2026-08-26*
