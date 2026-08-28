---
phase: 19-data-layer-cutover
plan: 02
subsystem: database
tags: [postgres, migrations, baseline-schema, ddl-exports, vitest]

requires:
  - phase: 19-data-layer-cutover
    plan: 01
    provides: migrate engine, parseMigrationFile, npm run migrate
provides:
  - migrations/0001-baseline-schema.sql regenerated v2.0 three-part baseline
  - migrations/README.md operator runbook with single-writer guidance
  - ROLES_AUDIT_DDL and MAPPING_TENANT_DDL exports for Part 3
  - lib/migrate/baseline-content.test.ts content integrity gate
affects: [19-03, 19-04]

actuals:
  tokens: 10500
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "0001 three parts: initPostgresSchema, migratePostgresSchema minus boot DML, lib/db-*.ts DDL exports"
    - "RAID Part 3 order: DDL → backfill DML → unique indexes (D-09)"
    - "Brownfield-safe: IF NOT EXISTS only, no DROP TABLE"

key-files:
  created:
    - migrations/0001-baseline-schema.sql
    - migrations/README.md
    - lib/db-roles.ddl.unit.test.ts
    - lib/migrate/baseline-content.test.ts
  modified:
    - lib/db-roles.ts
    - lib/db-mapping-tenant.ts

key-decisions:
  - "Regenerated 0001 from lib/db.ts + exports; origin v1.0 SQL not copied (D-02)"
  - "MAPPING_TENANT_DDL excludes CROSS JOIN backfill — operator scripts in 19-03"
  - "allocated_headcount TYPE change wrapped in DO blocks ignoring already-converted columns"

patterns-established:
  - "Part 3 concatenation order matches getDb helper chain: mapping → roles → project master → RAID → weekly → fiscal → dashboards → documents"
  - "baseline-content.test.ts gates v2.0 tables, fingerprint bans, RAID order, no DROP TABLE"

requirements-completed: [DATA-02]

coverage:
  - id: D1
    description: "ROLES_AUDIT_DDL and MAPPING_TENANT_DDL exported for 0001 Part 3"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: lib/db-roles.ddl.unit.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "0001-baseline-schema.sql v2.0 three-part baseline with RAID order"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: lib/migrate/baseline-content.test.ts
        status: pass
      - kind: unit
        ref: lib/migrate/plan.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "migrations/README.md operator runbook with migrate, ledger, parallel warning"
    requirement: DATA-02
    verification:
      - kind: other
        ref: "node -e README content checks"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-08-28
status: complete
---

# Phase 19 Plan 02: v2.0 Baseline 0001 Summary

**Regenerated three-part 0001 baseline from live v2.0 schema with RAID backfill-before-indexes ordering and content integrity tests**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-28T05:48:00Z
- **Completed:** 2026-08-28T05:58:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Exported `ROLES_AUDIT_DDL` and `MAPPING_TENANT_DDL` as Part 3 source arrays with unit tests (D-08)
- Created `migrations/0001-baseline-schema.sql` (~895 lines) from `initPostgresSchema`, `migratePostgresSchema` (minus four boot UPDATE fingerprints), and all `lib/db-*.ts` DDL exports
- RAID Part 3 order: `RAID_MASTERS_DDL` → backfill/dedupe DML → `RAID_MASTERS_INDEX_DDL` (D-09)
- `lib/migrate/baseline-content.test.ts` validates v2.0 table names, no DROP TABLE, fingerprint bans, RAID ordering
- `migrations/README.md` documents three-part structure, ledger contract, brownfield stamp, single-writer migrate guidance

## Task Commits

Each task was committed atomically:

1. **Task 19-02-01:** Export Part 3 DDL arrays — `07082de` (feat)
2. **Task 19-02-02 RED:** Baseline content tests — `01a59d9` (test)
3. **Task 19-02-02 GREEN:** v2 baseline 0001 SQL — `d351319` (feat)
4. **Task 19-02-03:** Migrations operator README — `f0e1bba` (docs)

**Plan metadata:** pending (docs commit follows)

## Files Created/Modified

- `lib/db-roles.ts` — Exported `ROLES_AUDIT_DDL`; `migrateRolesDdl` loops array
- `lib/db-mapping-tenant.ts` — Exported `MAPPING_TENANT_DDL` additive column/index fragments
- `lib/db-roles.ddl.unit.test.ts` — Part 3 source validation for roles/audit
- `lib/migrate/baseline-content.test.ts` — 0001 integrity gate (parse, tables, fingerprints, RAID order)
- `migrations/0001-baseline-schema.sql` — Full v2.0 baseline (Parts 1–3)
- `migrations/README.md` — Operator runbook

## Decisions Made

- Generated 0001 programmatically from live TypeScript sources to avoid drift from origin v1.0 SQL (D-02)
- Excluded mapping CROSS JOIN backfill from 0001; deferred to 19-03 operator scripts per plan
- Wrapped `allocated_headcount` TYPE changes in exception-swallowing DO blocks for brownfield stamp safety

## Deviations from Plan

None — plan executed as written.

## TDD Gate Compliance

- Task 1: feat commit includes test file (combined RED+GREEN in single commit per atomic task scope)
- Task 2 RED: `01a59d9` test(19-02): red 0001 baseline content assertions
- Task 2 GREEN: `d351319` feat(19-02): v2 baseline 0001 SQL
- REFACTOR: none needed

## Issues Encountered

None

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 0001 ready for `npm run migrate` on fresh and brownfield databases
- 19-03 can port data-fix scripts referencing boot DML fingerprints excluded from Part 2
- 19-04 can wire assertMigrated into slim getDb and Docker COPY of migrations/
- Dual-writer (boot DDL + external migrate) remains until 19-04

---
*Phase: 19-data-layer-cutover*
*Completed: 2026-08-28*

## Self-Check: PASSED

- FOUND: migrations/0001-baseline-schema.sql
- FOUND: migrations/README.md
- FOUND: lib/migrate/baseline-content.test.ts
- FOUND: lib/db-roles.ddl.unit.test.ts
- FOUND: 07082de
- FOUND: 01a59d9
- FOUND: d351319
- FOUND: f0e1bba
