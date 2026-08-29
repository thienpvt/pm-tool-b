---
phase: 19-data-layer-cutover
plan: 01
subsystem: database
tags: [postgres, migrate, tsx, checksum-ledger, advisory-lock]

requires: []
provides:
  - lib/migrate/plan.ts with parseMigrationFile, planPendingMigrations, sha256
  - lib/migrate/runner.ts with runMigrations, computePendingMigrations, advisory lock
  - lib/migrate/assertMigrated.ts boot guard with legacy brownfield probe
  - scripts/migrate.ts CLI (apply + --check)
  - npm run migrate with tsx@4.23.12
  - export resolveSsl from lib/db.ts
affects: [19-02, 19-03, 19-04]

actuals:
  tokens: 10500
  tasks: 3
  commits: 4

tech-stack:
  added: [tsx@4.23.12]
  patterns:
    - "Checksum ledger in schema_migrations with sha256 per file"
    - "Session advisory lock (1347246335) serialises migrate runs"
    - "assertMigrated fail-closed with legacy companies-table brownfield probe"

key-files:
  created:
    - lib/migrate/plan.ts
    - lib/migrate/runner.ts
    - lib/migrate/assertMigrated.ts
    - lib/migrate/plan.test.ts
    - lib/migrate/runner.test.ts
    - lib/migrate/assertMigrated.test.ts
    - scripts/migrate.ts
    - migrations/.gitkeep
  modified:
    - lib/db.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Ported origin gsd/quick-260826-ded-data-layer-migrations runner/ledger pattern verbatim; no origin 0001 SQL (D-02)"
  - "Real-Postgres integration test uses inline probe SQL and schema_migrations_probe ledger, not shipped 0001 (19-02)"
  - "Task 19-01-02 GREEN satisfied by task 1 runner/plan implementation — no separate feat commit needed"

patterns-established:
  - "Migration filenames: NNNN-name.sql (1-4 digit version, hyphens in tail)"
  - "One client.query(file.sql) per migration inside BEGIN/COMMIT — no semicolon splitting"
  - "computePendingMigrations treats missing ledger as empty applied set (--check preview)"

requirements-completed: [DATA-01, DATA-02]

coverage:
  - id: D1
    description: "parseMigrationFile and planPendingMigrations with checksum drift detection"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: lib/migrate/plan.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "runMigrations advisory lock, ledger apply, idempotent second run, ROLLBACK on failure"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: lib/migrate/runner.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "assertMigrated fail-closed with npm run migrate runbook and legacy brownfield probe"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: lib/migrate/assertMigrated.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run migrate CLI with tsx@4.23.12 and exported resolveSsl"
    requirement: DATA-02
    verification:
      - kind: other
        ref: "node -e package.json + scripts/migrate.ts checks"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-28
status: complete
---

# Phase 19 Plan 01: Migrate Engine Summary

**Checksum-ledger migrate engine with advisory lock, assertMigrated boot guard, and tsx CLI — origin pattern ported without v1.0 baseline SQL**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-28T05:42:00Z
- **Completed:** 2026-08-28T05:47:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Shipped `lib/migrate/{plan,runner,assertMigrated}.ts` ported from origin branch as structural pattern only (D-02)
- TDD RED/GREEN: failing tests first, then production modules; 19 tests pass (1 Postgres integration skipped without TEST_DATABASE_URL)
- `npm run migrate` via `npx tsx scripts/migrate.ts` with `--check` preview mode; tsx pinned exactly at 4.23.12
- Exported `resolveSsl` from `lib/db.ts` for CLI SSL; getDb boot DDL unchanged (19-04 scope)
- Empty `migrations/` directory ready for 19-02 baseline regeneration

## Task Commits

Each task was committed atomically:

1. **Task 19-01-01 RED:** End-to-end tracer tests — `11a3c39` (test)
2. **Task 19-01-01 GREEN:** Ledger migrate engine and boot assert — `6a1f966` (feat)
3. **Task 19-01-02 RED:** Drift/duplicate/rollback/check tests — `debcf0d` (test)
4. **Task 19-01-03:** tsx migrate CLI and export resolveSsl — `6924d97` (feat)

**Plan metadata:** pending (docs commit follows)

## Files Created/Modified

- `lib/migrate/plan.ts` — Filename parse, sha256, pending plan with drift detection
- `lib/migrate/runner.ts` — Advisory lock, ledger CREATE, BEGIN/COMMIT apply loop, computePendingMigrations
- `lib/migrate/assertMigrated.ts` — Ledger probe + legacy companies brownfield fallback
- `lib/migrate/*.test.ts` — Unit tests (FakeClient) + probe Postgres integration
- `scripts/migrate.ts` — CLI: apply pending migrations then seed via getDb(); `--check` preview
- `lib/db.ts` — Exported `resolveSsl` (boot chain unchanged)
- `package.json` — `migrate` script + tsx@4.23.12 devDependency
- `migrations/.gitkeep` — Empty migrations dir placeholder

## Decisions Made

- Used inline probe SQL (`0001-probe.sql`) for real-Postgres runner test instead of reading non-existent `0001-baseline-schema.sql` (19-02 deliverable)
- Task 19-01-02 GREEN implementation was complete in task 1 feat commit; only added missing `computePendingMigrations` missing-ledger test in task 2 RED

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Task 2 GREEN Omission

Task 19-01-02 specified a separate `feat(19-01): migrate drift lock and check preview` commit, but drift/duplicate/rollback/check behavior was fully implemented in the task 1 GREEN commit (`6a1f966`). Task 2 only required adding the `computePendingMigrations` missing-ledger test case, which passed immediately against existing code.

## TDD Gate Compliance

- RED: `11a3c39` test(19-01): red migrate plan runner assert
- GREEN: `6a1f966` feat(19-01): ledger migrate engine and boot assert
- Additional RED: `debcf0d` test(19-01): red drift duplicate rollback check
- REFACTOR: none needed

## Issues Encountered

None

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Migrate engine ready for 19-02 to regenerate `migrations/0001-baseline-schema.sql` from current v2.0 schema
- assertMigrated shipped but not yet wired into getDb (19-04)
- Dual-writer prohibition (boot DDL + external migrate) remains until 19-04 slim getDb

---
*Phase: 19-data-layer-cutover*
*Completed: 2026-08-28*

## Self-Check: PASSED

- FOUND: lib/migrate/plan.ts
- FOUND: lib/migrate/runner.ts
- FOUND: lib/migrate/assertMigrated.ts
- FOUND: scripts/migrate.ts
- FOUND: 11a3c39
- FOUND: 6a1f966
- FOUND: debcf0d
- FOUND: 6924d97
