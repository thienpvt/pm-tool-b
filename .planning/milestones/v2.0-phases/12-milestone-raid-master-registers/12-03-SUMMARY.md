---
phase: 12-milestone-raid-master-registers
plan: 03
subsystem: api
tags: [raid, postgres, vitest, due-date-history, overdue]

requires:
  - phase: 12-milestone-raid-master-registers
    provides: "Schema (raid_due_date_history), write-gated updateRisk/updateIssue from 12-01/12-02"
provides:
  - appendDueDateHistory INSERT-only repo wired on due_date change
  - listOpenRisks/listRisks/listOpenIssues/listIssues with is_overdue and D-07 ordering
  - listHighOpenRaid and listTechnologyCouncilIssues in raid-masters.service
affects: [phase-16-dashboards, phase-13-snapshots]

actuals:
  tokens: 8000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Append-only raid_due_date_history on normalized due_date string compare"
    - "UTC today computed inside repo for is_overdue without signature changes"
    - "Company-scoped UNION ALL for High Open/In Progress RAID record counts"

key-files:
  created:
    - lib/repositories/raid-due-date-history.repo.ts
  modified:
    - lib/services/risks.service.ts
    - lib/services/issues.service.ts
    - lib/repositories/risks.repo.ts
    - lib/repositories/issues.repo.ts
    - lib/services/raid-masters.service.ts

key-decisions:
  - "Load prior row only when fields.due_date is present to avoid extra reads on unrelated updates"
  - "listHighOpenRaid lives in risks.repo as UNION ALL; count is records.length in service"

patterns-established:
  - "Due-date audit: appendDueDateHistory + auditLog action due_date_change with before/after due_date only"
  - "RAID register ORDER BY: Open/In Progress first, High→Medium→Low, overdue first within severity"

requirements-completed: [RAID-04, RAID-05, RAID-06]

coverage:
  - id: D1
    description: "Due-date changes append raid_due_date_history and auditLog; identical values silent"
    requirement: RAID-04
    verification:
      - kind: unit
        ref: lib/services/risks.service.unit.test.ts#appends due-date history and auditLog when due_date changes
        status: pass
      - kind: unit
        ref: lib/services/issues.service.unit.test.ts#appends due-date history and auditLog when due_date changes
        status: pass
    human_judgment: false
  - id: D2
    description: "Open RAID lists flag is_overdue and default D-07 severity/overdue ordering"
    requirement: RAID-05
    verification:
      - kind: unit
        ref: lib/repositories/risks.repo.test.ts#orders High overdue before High not-overdue before Medium with is_overdue flag
        status: pass
      - kind: unit
        ref: lib/repositories/issues.repo.test.ts#orders High overdue before High not-overdue before Medium with is_overdue flag
        status: pass
    human_judgment: false
  - id: D3
    description: "listHighOpenRaid counts records; listTechnologyCouncilIssues company-scoped"
    requirement: RAID-06
    verification:
      - kind: unit
        ref: lib/services/raid-masters.service.unit.test.ts#listHighOpenRaid returns record count not distinct projects
        status: pass
      - kind: unit
        ref: lib/services/raid-masters.service.unit.test.ts#listTechnologyCouncilIssues delegates to repo with companyId
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-08-26
status: complete
---

# Phase 12 Plan 03: RAID History, Ordering & Company Lists Summary

**Append-only due-date history, overdue-flagged severity-ordered RAID registers, and company-scoped High RAID record counts plus technology-council issue lists via raid-masters.service**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-26T03:38:00Z
- **Completed:** 2026-08-26T03:42:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- `updateRisk` / `updateIssue` append `raid_due_date_history` and `auditLog` action `due_date_change` only when normalized due_date strings differ (D-06, D-10, RAID-04)
- `listOpenRisks`, `listRisks`, `listOpenIssues`, `listIssues` expose `is_overdue` and D-07 default ordering (RAID-04, RAID-05)
- `raid-masters.service` exports `listHighOpenRaid` `{ records, count }` and `listTechnologyCouncilIssues` alongside existing milestone helpers (D-08, D-15, RAID-06)

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1: Append due-date history on actual change** — `618011d` (test), `d0d8a45` (feat)
2. **Task 2: Default RAID list order and overdue flag** — `4b8394f` (test), `d5805f3` (feat)
3. **Task 3: Export High RAID counts and technology-council list** — `811029d` (test), `c02b933` (feat)

## Files Created/Modified

- `lib/repositories/raid-due-date-history.repo.ts` — INSERT-only `appendDueDateHistory`
- `lib/services/risks.service.ts` / `issues.service.ts` — due-date change history + audit wiring
- `lib/repositories/risks.repo.ts` / `issues.repo.ts` — `is_overdue`, CASE ordering, company-scoped list queries
- `lib/services/raid-masters.service.ts` — `listHighOpenRaid`, `listTechnologyCouncilIssues`

## Decisions Made

- Prior row fetched only when `fields.due_date !== undefined` to skip unnecessary reads on status-only updates
- `listHighOpenRaid` repo query uses UNION ALL with same tenant join as milestone company lists

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 16 dashboards can import `listUpcomingMilestones`, `listOverdueMilestones`, `listHighOpenRaid`, `listTechnologyCouncilIssues` from `raid-masters.service.ts`
- Phase 13 weekly snapshots can consume stable list contracts without dashboard UI in this phase

## Self-Check: PASSED

- FOUND: .planning/phases/12-milestone-raid-master-registers/12-03-SUMMARY.md
- FOUND: 618011d, d0d8a45, 4b8394f, d5805f3, 811029d, c02b933

---
*Phase: 12-milestone-raid-master-registers*
*Completed: 2026-08-26*
