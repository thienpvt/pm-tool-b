---
phase: 19-data-layer-cutover
plan: 03
subsystem: database
tags: [postgres, data-fixes, operator-scripts, vitest, tsx]

requires:
  - phase: 19-data-layer-cutover
    plan: 01
    provides: tsx runner, resolveSsl export, npm run migrate
provides:
  - scripts/data-fixes/ operator DML scripts (boot UPDATEs + v2 backfills)
  - runFix shared Pool runner with DATABASE_URL guard
  - lib/migrate/data-fixes.test.ts script content gate
affects: [19-04]

actuals:
  tokens: 5200
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Operator one-off DML under scripts/data-fixes/ — not imported from getDb"
    - "runFix uses resolveSsl + dedicated Pool closed in finally"
    - "v2 backfills delegate to existing lib/db-*.ts helpers with settings flags"

key-files:
  created:
    - scripts/data-fixes/run-sql-fix.ts
    - scripts/data-fixes/01-users-onboarding-completed.ts
    - scripts/data-fixes/02-portfolio-members-member-type.ts
    - scripts/data-fixes/03-projects-company-id-sync.ts
    - scripts/data-fixes/04-activities-jira-parent-repair.ts
    - scripts/data-fixes/backfill-weighted-completion.ts
    - scripts/data-fixes/backfill-user-roles.ts
    - scripts/data-fixes/backfill-pm-assignments.ts
    - scripts/data-fixes/backfill-raid-masters.ts
    - scripts/data-fixes/backfill-mapping-tenant.ts
    - scripts/data-fixes/README.md
    - lib/migrate/data-fixes.test.ts
  modified:
    - lib/db-raid-masters.ts

key-decisions:
  - "Port origin runFix pattern; SQL bodies from current lib/db.ts not origin-only"
  - "v2 backfills call exported helpers (backfillUserRoles, backfillPmAssignments, migrateMappingTableTenancy) rather than duplicate SQL"
  - "Export backfillRaidMasters for operator script reuse without running DDL/index path"

patterns-established:
  - "Boot UPDATE scripts use runFix({ name, sql }); procedural backfills use Pool + helper"
  - "data-fixes.test.ts gates sql templates for 01-04 and helper/flag markers for backfills"

requirements-completed: [DATA-03]

coverage:
  - id: D1
    description: "runFix helper and four boot UPDATE operator scripts under scripts/data-fixes/"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: lib/migrate/data-fixes.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "Five v2.0 backfill operator scripts with settings-flag idempotency"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: lib/migrate/data-fixes.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "scripts/data-fixes/README.md command list with DATABASE_URL requirement"
    requirement: DATA-03
    verification:
      - kind: other
        ref: "node -e README content checks"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-28
status: complete
---

# Phase 19 Plan 03: Data-Fix Operator Scripts Summary

**Boot UPDATEs and v2.0 backfills relocated to tsx operator scripts with runFix runner and content integrity tests — not on getDb boot path**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-28T05:53:00Z
- **Completed:** 2026-08-28T05:58:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Created `scripts/data-fixes/` with `runFix` shared runner (DATABASE_URL required, `resolveSsl`, pool closed in `finally`)
- Ported four former `migratePostgresSchema` boot UPDATEs as operator tsx scripts (01–04)
- Added five v2.0 backfill scripts: weighted completion, user roles, PM assignments, RAID masters, mapping tenant
- `lib/migrate/data-fixes.test.ts` asserts SQL templates and helper/flag markers (no migrations/*.sql UPDATE ban per D-09)
- `scripts/data-fixes/README.md` documents all commands and DATABASE_URL requirement

## Task Commits

Each task was committed atomically:

1. **Task 19-03-01 RED:** `80fcc6c` (test)
2. **Task 19-03-01 GREEN:** `6a30fb4` (feat)
3. **Task 19-03-02 RED:** `8962e27` (test)
4. **Task 19-03-02 GREEN:** `03bffb5` (feat)
5. **Task 19-03-03:** `99fcede` (docs)

**Plan metadata:** pending (docs commit follows)

## Files Created/Modified

- `scripts/data-fixes/run-sql-fix.ts` — Shared Pool runner exporting `runFix` and `Fix`
- `scripts/data-fixes/01-04-*.ts` — Former boot UPDATEs as one-off operator scripts
- `scripts/data-fixes/backfill-*.ts` — v2.0 settings-flag backfills
- `scripts/data-fixes/README.md` — Operator command list
- `lib/migrate/data-fixes.test.ts` — Script content integrity gate
- `lib/db-raid-masters.ts` — Exported `backfillRaidMasters` for operator script

## Decisions Made

- Used current `lib/db.ts` SQL strings (identical to origin for 01–04)
- Weighted completion script uses `STATUS_WEIGHTS` + settings flag stamp (origin pattern)
- Procedural backfills import existing helpers instead of duplicating parameterized loops

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Exported backfillRaidMasters**
- **Found during:** Task 19-03-02
- **Issue:** `backfillRaidMasters` was private; operator script could not call it without duplicating dedupe logic
- **Fix:** Added export to `lib/db-raid-masters.ts`
- **Files modified:** lib/db-raid-masters.ts
- **Committed in:** `03bffb5`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minimal export enables clean operator script without DDL/index side effects.

## TDD Gate Compliance

- Task 1 RED: `80fcc6c` test(19-03): red data-fix scripts exist
- Task 1 GREEN: `6a30fb4` feat(19-03): boot UPDATE data-fix scripts
- Task 2 RED: `8962e27` test(19-03): red v2 backfill script assertions
- Task 2 GREEN: `03bffb5` feat(19-03): v2 backfill operator scripts
- REFACTOR: none needed

## Issues Encountered

None

## User Setup Required

None — operators set `DATABASE_URL` at runtime when invoking scripts.

## Next Phase Readiness

- 19-04 can remove boot DML from `getDb()` and grep-verify no imports from `scripts/data-fixes/`
- Dual-writer (boot DML + operator scripts) remains until 19-04 slim getDb
- All scripts runnable via `npx tsx scripts/data-fixes/<file>.ts`

---
*Phase: 19-data-layer-cutover*
*Completed: 2026-08-28*

## Self-Check: PASSED

- FOUND: scripts/data-fixes/run-sql-fix.ts
- FOUND: scripts/data-fixes/README.md
- FOUND: lib/migrate/data-fixes.test.ts
- FOUND: 80fcc6c
- FOUND: 6a30fb4
- FOUND: 8962e27
- FOUND: 03bffb5
- FOUND: 99fcede
