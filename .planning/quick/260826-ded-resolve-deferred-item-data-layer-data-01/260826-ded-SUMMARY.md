---
phase: quick/260826-ded-data-layer
plan: 01
subsystem: database
tags: [migrations, postgres, pg, tsx, data-fixes, ledger, checksum, nextjs-standalone]

# Dependency graph
requires: []
provides:
  - Versioned SQL migration runner with sha256 checksum ledger (DATA-02)
  - External `npm run migrate` job replacing getDb() boot-time schema creation (DATA-01)
  - Four data-fix UPDATEs + weighted-completion backfill extracted to one-off scripts (DATA-03)
  - Docker runner image carrying migrations/ + scripts/ for future auto-migrate wiring
affects: [deploy wiring (Railway/k8s migrate job), future schema changes (NNNN-*.sql files), CI drift gate]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate (chars/4 over realized diff)
actuals:
  tokens: 27230
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added:
    - tsx 4.23.12 (pinned devDependency — see Decisions; the plan's "no deps added" constraint was knowingly broken per operator Decision 2)
  patterns:
    - Versioned SQL migrations applied via a single pooled connection under a session advisory lock
    - schema_migrations ledger with per-file sha256 checksum; checksum drift throws instead of silently skipping
    - One multi-statement BEGIN/COMMIT query per migration (atomic file application)
    - getDb() = connect -> assertMigrated guard -> cache singleton -> seed-if-empty (never writes schema)

key-files:
  created:
    - lib/migrate/plan.ts — pure planning logic: parseMigrationFile, sha256, planPendingMigrations
    - lib/migrate/runner.ts — runMigrations + computePendingMigrations, advisory-lock + ledger
    - lib/migrate/assertMigrated.ts — fast-fail boot guard
    - scripts/migrate.ts — npm run migrate CLI (--check gate)
    - migrations/0001-baseline-schema.sql — 35 CREATE TABLE statements, verbatim from initPostgresSchema
    - migrations/0002-existing-schema-additions.sql — 54 DDL statements + 2 DO-blocked type conversions
    - migrations/README.md — runbook + deploy wiring contract
    - scripts/data-fixes/{01,02,03,04}-*.ts, backfill-weighted-completion.ts, run-sql-fix.ts
  modified:
    - lib/db.ts — deleted initPostgresSchema/migratePostgresSchema/backfillWeightedCompletion; getDb() now connect+guard+seed; export resolveSsl + seedAuthData
    - package.json — migrate script; tsx pinned devDependency
    - package-lock.json — tsx 4.23.12
    - Dockerfile — COPY migrations/ + scripts/ into runner stage
    - .dockerignore — !migrations/*.sql, !scripts/migrate.ts

key-decisions:
  - "Pinned tsx 4.23.12 as a devDependency instead of npx tsx (operator Decision 2): the Docker runner stage has no npm registry access, so an in-container `npm run migrate` with npx tsx would fail on first use; a pinned devDependency makes `npm ci` + migrate hermetic. Knowingly breaks the plan's no-deps claim, which the operator authorized."
  - "No predev/prestart lifecycle migrate script (operator Decision 1): .env points at a SHARED database; migrations run only on explicit `npm run migrate`. The assertMigrated fast-fail message is the replacement for silent boot-time schema creation."
  - "assertMigrated tolerates a legacy 0.1.x-era database (companies table present, no ledger) so a dev who has not run migrate yet still boots; a genuinely fresh DB fails fast with the runbook message."
  - "The two ALTER COLUMN allocated_headcount TYPE NUMERIC(6,1) conversions ship as type-guarded DO blocks in 0002 (they are the only statements that would fail if re-run); 0001 creates the columns as INTEGER and 0002 converts them, reproducing the exact final schema."
  - "Backfill flag write uses the fixed value from lib/db.ts (`completion_pct_weighted_v1`) so the one-off script re-stamps the same flag the app's removed boot-time backfill used."

patterns-established:
  - "Migration runner: single pinned PoolClient + session advisory lock serialises concurrent migrate runs; each migration file runs as ONE multi-statement query in BEGIN/COMMIT so a failure rolls back the whole file."
  - "Ledger: schema_migrations(version PK, name, checksum, applied_at); planPendingMigrations collects drifted checksums and the runner throws before applying anything."
  - "Boot guard: getDb() asserts the ledger exists via a SELECT 1 LIMIT 1 before caching the singleton — no file reads, preserving output:'standalone'."

requirements-completed: [DATA-01, DATA-02, DATA-03]

coverage:
  - id: D1
    description: "Versioned migration runner (plan.ts/runner.ts) with sha256 ledger, ordering, idempotency, drift detection, and per-file atomic application"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "lib/migrate/plan.test.ts#planPendingMigrations ordering/pending/drift"
        status: pass
      - kind: unit
        ref: "lib/migrate/runner.test.ts#runMigrations (unit, fake client)"
        status: pass
      - kind: integration
        ref: "lib/migrate/runner.test.ts#runMigrations against real Postgres (skipIf !hasTestDb)"
        status: unknown
    human_judgment: false
  - id: D2
    description: "migrations/0001-baseline-schema.sql + migrations/0002-existing-schema-additions.sql capture the full existing schema (baseline + additions) as versioned SQL"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "lib/migrate/data-fixes.test.ts#migrations directory integrity"
        status: pass
    human_judgment: false
  - id: D3
    description: "getDb() no longer creates schema or runs the migration loop; it connects, fails fast via assertMigrated when unmigrated, and seeds only when users is empty"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "lib/migrate/assertMigrated.test.ts#assertMigrated"
        status: pass
      - kind: unit
        ref: "grep -c 'initPostgresSchema|migratePostgresSchema|backfillWeightedCompletion' lib/db.ts == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run migrate CLI with --check gate, DATABASE_URL guard, resolveSsl reuse; after a successful run it seeds via getDb()"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (CLI typechecks)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Four data-fix UPDATEs + weighted-completion backfill extracted to operator-run one-off scripts under scripts/data-fixes/; lib/db.ts contains none of them"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/migrate/data-fixes.test.ts#one-off data-fix scripts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Runner image carries migrations/ + scripts/ (Dockerfile COPYs) and .dockerignore negation allows them through; standalone build still succeeds"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "npm run build (output: standalone, BUILD_EXIT=0)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Real-DB idempotency proof: scratch-DB npm run migrate twice + live shared DB adoption run (stamps ledger, no-op statements)"
    requirement: DATA-01
    verification: []
    human_judgment: true
    rationale: "Standing operator constraint forbids touching any database during execution — this verification is operator-pending."

# Metrics
duration: 90min
completed: 2026-08-26
status: complete
---

# Quick 260826-ded: Resolve Data Layer Deferred Items (DATA-01/02/03) — Summary

**Versioned SQL migration runner with a sha256 checksum ledger (`npm run migrate`), a fast-fail `assertMigrated` boot guard, and the four boot-time data-fix UPDATEs + weighted-completion backfill moved into operator-run one-off scripts**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-08-26T10:50:00Z (approx)
- **Completed:** 2026-08-26T11:35:00Z (approx)
- **Tasks:** 3 (all executed, per operator Decision 3)
- **Files modified:** 22

## Accomplishments

- **Migration substrate (DATA-02):** `lib/migrate/plan.ts` (pure planning: `parseMigrationFile`, `sha256`, `planPendingMigrations` with duplicate-version throw and checksum-drift collection) + `lib/migrate/runner.ts` (`runMigrations` with a session advisory lock, `schema_migrations` ledger, per-file `BEGIN`/`COMMIT` atomic application, `ROLLBACK` + filename on failure, and `computePendingMigrations` for `--check`).
- **Versioned SQL files:** `migrations/0001-baseline-schema.sql` (35 `CREATE TABLE` statements extracted verbatim from `initPostgresSchema`) and `migrations/0002-existing-schema-additions.sql` (54 DDL statements from `migratePostgresSchema` in original order, with the two `allocated_headcount` numeric conversions as type-guarded `DO` blocks). `lib/migrate/data-fixes.test.ts` proves the real directory parses with unique ascending versions and that 0002 contains zero `UPDATE` statements.
- **External migrate job (DATA-01):** `scripts/migrate.ts` CLI wired as `npm run migrate` (with `-- --check` gate), `getDb()` stripped to connect → `assertMigrated` → cache → `seedAuthData`, and `lib/migrate/assertMigrated.ts` failing fast with the runbook message when the ledger is missing. The zero-identifier grep (`initPostgresSchema`/`migratePostgresSchema`/`backfillWeightedCompletion` in `lib/db.ts`) is 0.
- **Data fixes moved out of boot (DATA-03):** five one-off scripts under `scripts/data-fixes/` (`01-users-onboarding-completed`, `02-portfolio-members-member-type`, `03-projects-company-id-sync`, `04-activities-jira-parent-repair`, `backfill-weighted-completion`) plus a shared `run-sql-fix.ts` runner; SQL copied verbatim from the removed boot-path statements.
- **Deploy plumbing:** Dockerfile runner stage now COPYs `migrations/` + `scripts/`; `.dockerignore` negation (`!migrations/*.sql`, `!scripts/migrate.ts`) lets them through the `*.sql` ignore; `migrations/README.md` documents the ledger contract, the first-run adoption sequence, and the Railway/k8s wiring recipe (container auto-migrate deliberately deferred).

## Task Commits

Each task was committed atomically with TDD RED/GREEN splits:

1. **Task 1: Versioned migration runner + baseline SQL + migrate CLI** — `264334c` (test), `4c9dfa1` (feat)
2. **Task 2: Migration 0002 + data-fix extraction** — `d91e1a2` (test), `bb8064d` (feat)
3. **Task 3: getDb() strip + assertMigrated guard + deploy wiring** — `898cc09` (test), `f3b9694` (feat)

**Plan metadata:** docs commit is handled by the orchestrator (not committed per quick-task constraints).

## Files Created/Modified

- `lib/migrate/plan.ts` — pure migration planning logic
- `lib/migrate/runner.ts` — advisory-lock runner + ledger + `computePendingMigrations`
- `lib/migrate/assertMigrated.ts` — fast-fail boot guard
- `lib/migrate/plan.test.ts`, `lib/migrate/runner.test.ts`, `lib/migrate/assertMigrated.test.ts`, `lib/migrate/data-fixes.test.ts` — 21 tests (1 real-DB skip)
- `migrations/0001-baseline-schema.sql` — 35 CREATE TABLE statements
- `migrations/0002-existing-schema-additions.sql` — 54 DDL statements + 2 DO blocks
- `migrations/README.md` — runbook + deploy contract
- `scripts/migrate.ts` — CLI
- `scripts/data-fixes/run-sql-fix.ts` + 5 fix scripts
- `lib/db.ts` — restructured `getDb()`; deleted schema/migration/backfill functions; exported `resolveSsl` + `seedAuthData`
- `package.json` / `package-lock.json` — `migrate` script; pinned `tsx` devDependency
- `Dockerfile` — runner stage COPYs `migrations/` + `scripts/`
- `.dockerignore` — negation entries for migration SQL and migrate script

## Decisions Made

1. **tsx pinned as a devDependency (operator Decision 2 — option a).** The plan claimed `tsx` was already a dependency; it was not. I chose option (a) — pin `tsx@4.23.12` — because `npx tsx` needs a registry fetch on first use and the Docker `runner` stage has no npm network access, so any documented in-container `npm run migrate` recipe would be broken with `npx tsx`. A pinned devDependency makes `npm ci` + `npm run migrate` hermetic in any environment that can install devDeps. The plan's "no dependencies added" constraint is knowingly broken for this one package, as the operator authorized. Option (b) (keep `npx tsx`, document in-container migrate as non-working) was rejected because the plan's own deploy contract needs `npm run migrate` in the container to eventually work, and option (c) (build a compiled migrate artifact) adds build machinery not justified for a quick task.
2. **No `predev`/`prestart` script (operator Decision 1).** Migrations run only on explicit `npm run migrate`. The `assertMigrated` fast-fail message is the designed replacement for the schema `getDb()` used to create on `next dev`.
3. **assertMigrated tolerates legacy databases.** A pre-Task-3 database (core schema present via the old inline array, no ledger) still boots; a genuinely fresh database fails fast. This prevents the guard from bricking devs who have not run migrate yet, and matches the plan's Test 2 intent.
4. **0002 keeps the two ALTER TYPE conversions as DO blocks.** 0001 creates `allocated_headcount` as INTEGER; 0002 converts to NUMERIC(6,1) — the sequential application reproduces the exact final schema, and the DO guard makes the conversion a no-op on an already-converted database (the only statements that would otherwise fail on re-run).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Type error in scripts/migrate.ts (`f.filename` on a string)**
- **Found during:** Task 1 (GREEN verification, `npx tsc --noEmit`)
- **Issue:** The CLI iterated `result.applied` (a `string[]`) and referenced `f.filename`, which does not exist on a string.
- **Fix:** Changed the loop to print `f` directly (`Applied ${f}`).
- **Files modified:** scripts/migrate.ts
- **Verification:** `npx tsc --noEmit` passes.
- **Committed in:** 4c9dfa1 (Task 1 feat commit)

**2. [Rule 3 - Blocking] `/s` regex flag not allowed under ES2017 target**
- **Found during:** Task 3 (GREEN verification, `npx tsc --noEmit`)
- **Issue:** `lib/migrate/data-fixes.test.ts` used the `/s` flag, which requires ES2018; tsconfig targets ES2017.
- **Fix:** Removed the redundant `/s` flag — `[^`]*` already matches across newlines.
- **Files modified:** lib/migrate/data-fixes.test.ts
- **Verification:** `npx tsc --noEmit` passes.
- **Committed in:** f3b9694 (Task 3 feat commit)

**3. [Rule 3 - Blocking] data-fixes test regex missed `const sql = `...`` form**
- **Found during:** Task 2 (GREEN verification)
- **Issue:** `lib/migrate/data-fixes.test.ts` only matched `sql: `...``, but `backfill-weighted-completion.ts` builds `const sql = `...``.
- **Fix:** Broadened the extraction regex to `sql\s*[:=]\s*`([^`]*)`.
- **Files modified:** lib/migrate/data-fixes.test.ts
- **Verification:** migrate test suite passes.
- **Committed in:** d91e1a2 (Task 2 test commit)

**4. [Rule 2 - Missing Critical] .dockerignore negation verified against ordering semantics**
- **Found during:** Task 3 (verification)
- **Issue:** `.dockerignore` had a bare `*.sql` line that would drop the migration files from the builder context. The plan prescribed adding negations, but the fix only works if later patterns win (gitignore precedence) AND the negation is not itself shadowed.
- **Fix:** Added `!migrations/*.sql` and `!scripts/migrate.ts` directly after the `*.sql` line. Because the `*.sql` rule is unanchored and the negations are more specific patterns that appear later, the specific include wins for `migrations/*.sql`; `scripts/migrate.ts` has no `*.ts` ignore to contend with. Docker was not available in this environment to run a live `docker build --check`, so this is verified by gitignore rule semantics (the same matcher Docker uses) rather than an actual build-context listing.
- **Files modified:** .dockerignore
- **Verification:** reasoning over gitignore precedence; flagged for operator/docker-confirm.
- **Committed in:** f3b9694 (Task 3 feat commit)

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 missing critical)
**Impact on plan:** All auto-fixes were necessary for typecheck/tests to pass or for the .dockerignore fix to actually work. No scope creep.

## Operator-Pending Human Checks

Per the standing constraint, no database was touched during execution. The following `<human-check>` items from the plan are **operator-pending** and were recorded in `.planning/WINDOWS.md` as `unrun-verify` entries (phase `260826-ded`):

1. **Task 1 / Task 3 scratch-DB migrate:** `DATABASE_URL=postgres://.../scratch_test npm run migrate` — confirm the full baseline+additions apply on a fresh DB and the second run prints `Migrations up to date` (idempotency proof).
2. **Task 1 real-DB integration suite:** `TEST_DATABASE_URL=postgres://.../scratch_test npm test -- --project node lib/migrate` — proves the real-Postgres idempotency path (the `describe.skipIf(!hasTestDb)` suite skips today because `TEST_DATABASE_URL` is unset).
3. **Task 3 boot guard:** on a migrated scratch DB, start the app and confirm it boots (guard passes); on a fresh empty DB WITHOUT migrating, confirm boot fails with the `Database schema not migrated — run "npm run migrate" first` message instead of a 500 storm.
4. **Live shared DB adoption:** run `npm run migrate` against the real shared `DATABASE_URL` once (with a scratch-DB rehearsal first per the README) to stamp the `schema_migrations` ledger — the ledger does not exist yet on the shared DB, so `npm run migrate -- --check` will report pending with exit code 1 until then.

## TDD Gate Compliance

All three tasks are `tdd="true"` and each has both a RED `test(...)` commit and a GREEN `feat(...)` commit in git log (verified in sequence): `264334c`→`4c9dfa1`, `d91e1a2`→`bb8064d`, `898cc09`→`f3b9694`. No REFACTOR commits were needed.

## Issues Encountered

- `lib/log.test.ts` continues to fail ("No test suite found") — it is a `tsx` self-check script, not a vitest suite; it failed identically before this change (baseline: 1 failed / 99 passed / 21 skipped files; 727 passed / 113 skipped tests). Not a regression, not fixed (out of scope).
- Docker CLI is not available in this environment, so the `.dockerignore` fix and the Dockerfile COPYs could not be verified against a live `docker build`. `npm run build` (Next standalone) succeeds, which validates the app side; the context-inclusion semantics are verified by gitignore-rule reasoning and flagged for operator confirm.

## Verification Results (Final)

- `npx tsc --noEmit` — **pass** (exit 0)
- `npm test` — **1 failed / 103 passed / 21 skipped** test files; **748 passed / 114 skipped** tests. The single failure is the pre-existing `lib/log.test.ts` (identical to baseline, not a regression).
- `npm run build` — **pass** (exit 0); `output: 'standalone'` preserved; `next.config.ts` untouched.
- `grep -c 'initPostgresSchema|migratePostgresSchema|backfillWeightedCompletion' lib/db.ts` — **0**.
- No database was touched (standing constraint). No merge/push performed; work stays on branch `gsd/quick-260826-ded-data-layer-migrations`.

## Next Phase Readiness

- The migration substrate, ledger, guard, data-fix scripts, and deploy plumbing are in place and verified statically. The operator's next action is the pending DB checks above (especially the live shared-DB adoption run), then wiring container auto-migrate (Railway release command / k8s initContainer) as a follow-up — documented in `migrations/README.md` and the plan's Deferred section.

---
*Phase: quick/260826-ded-data-layer*
*Completed: 2026-08-26*
