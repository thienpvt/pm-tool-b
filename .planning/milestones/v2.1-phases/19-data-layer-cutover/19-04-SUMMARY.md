---
phase: 19-data-layer-cutover
plan: 04
subsystem: database
tags: [postgres, getDb, assertMigrated, docker, ci, k8s, tsx]

requires:
  - phase: 19-data-layer-cutover
    plan: 01
    provides: assertMigrated, npm run migrate, resolveSsl export
  - phase: 19-data-layer-cutover
    plan: 02
    provides: migrations/0001-baseline-schema.sql
  - phase: 19-data-layer-cutover
    plan: 03
    provides: scripts/data-fixes/ operator DML (not on boot path)
provides:
  - Slim getDb connect + assertMigrated + seedAuthData only (DATA-01, D-05)
  - lib/db.getDb.boot.unit.test.ts source-scan gate
  - Dockerfile/compose/Railway migrate-then-server with tsx (D-07, D-10)
  - CI migrate step before Vitest (D-07)
  - k8s-migrate-job.yaml one-shot Job
affects: []

actuals:
  tokens: 13000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "getDb fail-closed via assertMigrated; no boot DDL or migrate* awaits"
    - "Container/CI start: npx tsx scripts/migrate.ts before app or tests"
    - "migrate* helpers and *_DDL remain in lib/db-*.ts for Part 3 tests (D-08)"

key-files:
  created:
    - lib/db.getDb.boot.unit.test.ts
    - k8s-migrate-job.yaml
  modified:
    - lib/db.ts
    - lib/db-documents.ddl.unit.test.ts
    - lib/db-dashboards.ddl.unit.test.ts
    - lib/db-fiscal-budget.ddl.unit.test.ts
    - test/repo-db.ts
    - Dockerfile
    - .dockerignore
    - railway.json
    - docker-compose.yml
    - .github/workflows/test.yml

key-decisions:
  - "Removed init/migrate/backfill from lib/db.ts; 0001 + operator scripts own that SQL"
  - "Runner image copies node_modules from deps so nextjs user can run npx tsx migrate"
  - "DDL wiring tests assert migrate helpers exported but not awaited by getDb (D-08)"

patterns-established:
  - "Boot scan test extracts getDb body region — forbids schema-init and await migrate*(pool)"
  - "Dual-writer prohibition resolved: external migrate is sole DDL writer at deploy/CI"

requirements-completed: [DATA-01, DATA-03]

coverage:
  - id: D1
    description: "getDb connects, asserts ledger, seeds only — no boot DDL or migrate* awaits"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: lib/db.getDb.boot.unit.test.ts
        status: pass
      - kind: unit
        ref: lib/migrate/assertMigrated.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "lib/db.ts does not import scripts/data-fixes"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: lib/db.getDb.boot.unit.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "Docker/Railway/compose ship migrations and run tsx migrate before server"
    requirement: DATA-01
    verification:
      - kind: other
        ref: "node -e Dockerfile/dockerignore/railway/compose checks"
        status: pass
    human_judgment: false
  - id: D4
    description: "CI runs npm run migrate against pm_tool_test before npm test"
    requirement: DATA-01
    verification:
      - kind: other
        ref: ".github/workflows/test.yml migrate step"
        status: pass
    human_judgment: false
  - id: D5
    description: "migrateDocuments/Dashboards/FiscalBudget remain exported; getDb does not await them"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: lib/db-documents.ddl.unit.test.ts
        status: pass
      - kind: unit
        ref: lib/db-dashboards.ddl.unit.test.ts
        status: pass
      - kind: unit
        ref: lib/db-fiscal-budget.ddl.unit.test.ts
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-28
status: complete
---

# Phase 19 Plan 04: Slim getDb Cutover Summary

**getDb connect-assert-seed only with Docker/CI/K8s migrate-before-start — dual writers eliminated**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-28T06:58:00Z
- **Completed:** 2026-08-28T07:06:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Slimmed `getDb()` to Pool → `assertMigrated` → `seedAuthData`; removed ~500 lines of boot DDL/DML from `lib/db.ts`
- Added `lib/db.getDb.boot.unit.test.ts` source-scan gate (DATA-01, DATA-03, D-05)
- Rewrote DDL wiring tests to assert migrate helpers exported but not called from getDb (D-08)
- Wired Dockerfile, Railway, docker-compose, and k8s Job to run `npx tsx scripts/migrate.ts` before app start
- CI applies migrations to `pm_tool_test` before Vitest suite

## Task Commits

Each task was committed atomically:

1. **Task 19-04-01 RED:** `7e8993e` (test)
2. **Task 19-04-01 GREEN:** `b4d182f` (feat)
3. **Task 19-04-02:** `1de562b` (feat)
4. **Task 19-04-03:** `5fa97c6` (ci)

**Plan metadata:** pending (docs commit follows)

## Files Created/Modified

- `lib/db.ts` — Slim getDb; removed init/migrate/backfill; import assertMigrated
- `lib/db.getDb.boot.unit.test.ts` — Boot path source scan
- `lib/db-*-*.ddl.unit.test.ts` — Wiring describes updated for post-cutover getDb
- `test/repo-db.ts` — Header documents ledger assert behavior
- `Dockerfile`, `.dockerignore` — COPY migrations/scripts/node_modules; migrate CMD
- `railway.json`, `docker-compose.yml` — migrate-then-server start commands
- `k8s-migrate-job.yaml` — One-shot migrate Job for inhouse namespace
- `.github/workflows/test.yml` — npm run migrate before npm test

## Decisions Made

- Deleted boot schema functions from lib/db.ts (not just uncalled) so getDb cannot regress to dual-writer
- Runner copies full node_modules from deps stage so tsx@4.23.12 available to nextjs user

## Deviations from Plan

None — plan executed as written.

## TDD Gate Compliance

- RED: `7e8993e` test(19-04): red slim getDb boot scan
- GREEN: `b4d182f` feat(19-04): getDb connect assert seed only
- REFACTOR: none needed

## Issues Encountered

None

## User Setup Required

None — operators run `npm run migrate` per migrations/README.md on brownfield DBs before deploy.

## Next Phase Readiness

- Phase 19 data-layer cutover complete — single writer (external migrate) at deploy/CI
- App replicas fail closed on unmigrated DBs via assertMigrated
- Operator data-fix scripts remain manual one-offs under scripts/data-fixes/

---
*Phase: 19-data-layer-cutover*
*Completed: 2026-08-28*

## Self-Check: PASSED

- FOUND: lib/db.getDb.boot.unit.test.ts
- FOUND: k8s-migrate-job.yaml
- FOUND: 7e8993e
- FOUND: b4d182f
- FOUND: 1de562b
- FOUND: 5fa97c6
