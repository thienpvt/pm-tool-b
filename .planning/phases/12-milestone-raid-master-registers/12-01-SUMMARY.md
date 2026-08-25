---
phase: 12-milestone-raid-master-registers
plan: 01
subsystem: api
tags: [milestones, raid-masters, postgres, vitest, cancel-in-place, migrateRaidMasters]

requires: []
provides:
  - migrateRaidMasters boot-time DDL in lib/db-raid-masters.ts
  - cancelMilestone service/repo with auditLog and HTTP DELETE mapping
  - listUpcomingMilestones / listOverdueMilestones in raid-masters.service
  - plan_end/end_date dual-write on milestone create/update
affects: [12-02, 12-03, phase-16-dashboards]

actuals:
  tokens: 7000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Settings-flag idempotent DDL orchestrator (db-raid-masters mirrors db-project-master)"
    - "Cancel-in-place UPDATE replaces DELETE FROM milestones"
    - "Company-scoped list helpers in raid-masters.service (D-15)"

key-files:
  created:
    - lib/db-raid-masters.ts
    - lib/db-raid-masters.ddl.unit.test.ts
    - lib/services/raid-masters.service.ts
    - lib/services/raid-masters.service.unit.test.ts
  modified:
    - lib/db.ts
    - lib/repositories/milestones.repo.ts
    - lib/services/milestones.service.ts
    - app/api/projects/[id]/milestones/[milestoneId]/route.ts
    - test/repo-db.ts

key-decisions:
  - "Three settings flags (ddl, backfill, index) run in order so backfill dedupes before unique indexes"
  - "raid-masters.service computes today and today+7 UTC date strings; repo receives explicit window bounds"

patterns-established:
  - "Milestone retire path is cancel UPDATE only — never DELETE FROM milestones (MS-05)"
  - "Effective end for upcoming/overdue is COALESCE(adjusted_end, plan_end) with UTC date-only strings"

requirements-completed: [MS-01, MS-02, MS-03, MS-05]

coverage:
  - id: D1
    description: "HTTP DELETE cancels milestone in place with auditLog; Viewer denied"
    requirement: MS-01
    verification:
      - kind: unit
        ref: "lib/services/milestones.service.unit.test.ts#cancelMilestone"
        status: pass
      - kind: unit
        ref: "app/api/projects/[id]/milestones/[milestoneId]/route.test.ts#DELETE"
        status: pass
    human_judgment: false
  - id: D2
    description: "migrateRaidMasters DDL with raid_due_date_history and unique index names"
    requirement: MS-05
    verification:
      - kind: unit
        ref: "lib/db-raid-masters.ddl.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Company-scoped upcoming/overdue lists with 7-day inclusive UTC window"
    requirement: MS-02
    verification:
      - kind: unit
        ref: "lib/repositories/milestones.repo.test.ts#listUpcomingMilestones"
        status: pass
      - kind: unit
        ref: "lib/services/raid-masters.service.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Overdue list uses effective end strictly before today UTC"
    requirement: MS-03
    verification:
      - kind: unit
        ref: "lib/repositories/milestones.repo.test.ts#listOverdueMilestones"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dual-write plan_end and end_date on create/update"
    requirement: MS-05
    verification:
      - kind: unit
        ref: "lib/repositories/milestones.repo.test.ts#dual-write"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-26
status: complete
---

# Phase 12 Plan 01: Milestone Cancel Spine Summary

**migrateRaidMasters boot DDL, cancel-in-place milestones with auditLog on HTTP DELETE, and company-scoped upcoming/overdue list helpers with plan_end/end_date dual-write**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 14
- **Commits:** 5 (2 RED + 2 feat + 1 RED for task 2)

## Accomplishments

- Added `lib/db-raid-masters.ts` with settings-flagged DDL, backfill (plan_end from end_date; code from legacy ids with dedup suffixes), and partial unique indexes on RAID codes
- Wired `migrateRaidMasters` in `getDb()` after `migrateProjectMaster`
- Replaced `deleteMilestone` with `cancelMilestone` (repo UPDATE + service write gate + `auditLog` action cancel); HTTP DELETE returns `{ ok: true }`
- Exported `listUpcomingMilestones` / `listOverdueMilestones` from `raid-masters.service.ts` with 7-day inclusive UTC window
- Dual-write `plan_end` and `end_date` on milestone create/update (D-14)

## Task Commits

1. **Task 12-01-01 RED:** `8a07961` — failing cancel + DDL tests
2. **Task 12-01-01 GREEN:** `12c513c` — cancel spine + migrateRaidMasters
3. **Task 12-01-02 RED:** `913ee7d` — failing list + dual-write tests
4. **Task 12-01-02 GREEN:** `95d5503` — upcoming/overdue lists + dual-write

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ALTER COLUMN migrations in test/repo-db.ts**
- **Found during:** Task 12-01-02
- **Issue:** Existing test DB milestones table lacked new lifecycle columns (`CREATE TABLE IF NOT EXISTS` no-op)
- **Fix:** Added `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for milestones, risks, and issues columns
- **Files modified:** test/repo-db.ts
- **Committed in:** `95d5503`

**2. [Rule 1 - Bug] Unique username in cancel scope repo test**
- **Found during:** Task 12-01-02
- **Issue:** Parallel test runs hit `users_username_unique` on repeated insert
- **Fix:** Use timestamp-suffixed username in cancel scope test
- **Files modified:** lib/repositories/milestones.repo.test.ts
- **Committed in:** `95d5503`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Test infrastructure only; production behavior matches plan.

## Tests

```
npx vitest run lib/db-raid-masters.ddl.unit.test.ts lib/services/milestones.service.unit.test.ts lib/services/raid-masters.service.unit.test.ts lib/repositories/milestones.repo.test.ts app/api/projects/[id]/milestones/[milestoneId]/route.test.ts
```

**Result:** 41 passed (5 files)

## Self-Check: PASSED

- FOUND: `.planning/phases/12-milestone-raid-master-registers/12-01-SUMMARY.md`
- FOUND: `lib/db-raid-masters.ts`
- FOUND: `lib/services/raid-masters.service.ts`
- FOUND commits: `8a07961`, `12c513c`, `913ee7d`, `95d5503`

## Next Phase Readiness

- Plans 12-02/12-03 can add RAID deactivate, auto codes, and due-date history append without moving `migrateRaidMasters`
- Phase 16 can import `listUpcomingMilestones` / `listOverdueMilestones` from `raid-masters.service`

---
*Phase: 12-milestone-raid-master-registers*
*Completed: 2026-08-26*
