---
phase: 19-data-layer-cutover
verified: 2026-08-28T06:20:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 10
  total: 10
  not_honored: []
human_verification:
  - test: "Stamp a live Railway/K8s/local brownfield database onto the ledger"
    expected: "Run npm run migrate against a snapshot of the production/shared DB; confirm no DROP occurs, v2.0 tables remain, schema_migrations has a row for 0001, and a second run is a no-op (--check clean)"
    why_human: "Requires production credentials and an existing brownfield dataset; automated tests use FakeClient or scratch DBs only (19-VALIDATION.md manual-only table)"
---

# Phase 19: Data Layer Cutover Verification Report

**Phase Goal:** Schema evolution is an external migrate job; a running app no longer initializes or mutates schema on cold start
**Verified:** 2026-08-28T06:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | After migrate has run, `getDb()` connects, asserts the ledger, and seeds only — no schema init or migrate loop (Roadmap SC1, DATA-01) | ✓ VERIFIED | `lib/db.ts` lines 122–143: `Pool` → `assertMigrated` → `PostgresClient` → `seedAuthData` only. No `initPostgresSchema`, `migratePostgresSchema`, or `await migrate*(pool)`. `lib/db.getDb.boot.unit.test.ts` passes. |
| 2 | Unmigrated DB fails fast with runbook message (DATA-01) | ✓ VERIFIED | `lib/migrate/assertMigrated.ts` throws `"Database schema not migrated — run \"npm run migrate\" first"`. `assertMigrated.test.ts` covers empty ledger and missing ledger+schema cases. |
| 3 | Schema changes ship as versioned SQL via `npm run migrate` with checksum ledger (Roadmap SC2, DATA-02) | ✓ VERIFIED | `package.json`: `"migrate": "npx tsx scripts/migrate.ts"`, `tsx@4.23.12`. `lib/migrate/plan.ts` + `runner.ts` record version+checksum; drift throws. `runner.test.ts` idempotency and checksum-drift tests pass. |
| 4 | `migrations/0001` includes v2.0 tables; three parts; no DROP; RAID order (Roadmap SC2, D-03/D-04/D-09) | ✓ VERIFIED | `migrations/0001-baseline-schema.sql` (890 lines): Part 1/2/3 labels, all eight v2.0 table names, no `DROP TABLE`, RAID DDL → backfill → indexes order. `baseline-content.test.ts` passes (incl. CR-01 semicolon fix). |
| 5 | Data-fix `UPDATE`s live under `scripts/data-fixes/` and are not on boot path (Roadmap SC3, DATA-03) | ✓ VERIFIED | 10 operator scripts + README. `lib/db.ts` has no `scripts/data-fixes` import. `data-fixes.test.ts` passes. `run-sql-fix.ts` uses dedicated Pool, ends in `finally`. |
| 6 | Brownfield code path stamps ledger without dropping v2.0 tables (Roadmap SC4, D-04) | ✓ VERIFIED | 0001 uses `IF NOT EXISTS` / guarded `DO` blocks only. `assertMigrated` legacy probe (companies table + `console.warn`, CR-02 LOCKED) allows interim boot. `migrations/README.md` documents brownfield adoption runbook. |
| 7 | Deploy/CI runs migrate before app/tests (D-07) | ✓ VERIFIED | `Dockerfile` COPY migrations+scripts; CMD `npx tsx scripts/migrate.ts && node server.js`. `railway.json` same startCommand. `k8s-migrate-job.yaml` one-shot Job. `.github/workflows/test.yml` runs `npm run migrate` before `npm test`. `.dockerignore` has `!migrations/*.sql`. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Decision Coverage

All 10 trackable CONTEXT.md locked decisions (D-01..D-10) honored by shipped artifacts.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `lib/migrate/plan.ts` | Filename parse, sha256, pending plan | ✓ VERIFIED | gsd-tools verify.artifacts 19-01: passed |
| `lib/migrate/runner.ts` | Advisory lock, ledger, apply loop | ✓ VERIFIED | gsd-tools verify.artifacts 19-01: passed |
| `lib/migrate/assertMigrated.ts` | Boot guard, no fs | ✓ VERIFIED | Wired from `getDb()` |
| `scripts/migrate.ts` | CLI apply/check | ✓ VERIFIED | Loads `migrations/*.sql`, calls runner |
| `migrations/0001-baseline-schema.sql` | Regenerated v2.0 baseline | ✓ VERIFIED | Substantive, no stubs |
| `scripts/data-fixes/*` | Operator DML scripts | ✓ VERIFIED | 10 scripts + README |
| `lib/db.ts` | Slim getDb + resolveSsl | ✓ VERIFIED | gsd-tools verify.artifacts 19-04: passed |
| `Dockerfile` / `k8s-migrate-job.yaml` / `.github/workflows/test.yml` | Migrate-before-start wiring | ✓ VERIFIED | All present and wired |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `lib/db.ts` `getDb` | `lib/migrate/assertMigrated.ts` | `await assertMigrated((sql) => pool.query(sql))` | ✓ WIRED | Line 134 in `lib/db.ts` |
| `lib/db.ts` `getDb` | `seedAuthData` | `await seedAuthData(_client)` | ✓ WIRED | Line 137 in `lib/db.ts` |
| `.github/workflows/test.yml` | `scripts/migrate.ts` | `npm run migrate` | ✓ WIRED | gsd-tools key-links verified |
| `scripts/migrate.ts` | `lib/migrate/runner.ts` | `runMigrations` / `computePendingMigrations` | ✓ WIRED | Imports and calls both |
| `scripts/data-fixes/run-sql-fix.ts` | `lib/db.ts` | `resolveSsl` import | ✓ WIRED | Line 12 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `getDb()` | DbClient queries | `pg.Pool` via `DATABASE_URL` | Yes — live Postgres | ✓ FLOWING |
| `assertMigrated` | ledger rows | `SELECT 1 FROM schema_migrations` | Yes — DB query | ✓ FLOWING |
| `runMigrations` | applied files | `migrations/*.sql` on disk + ledger INSERT | Yes — mutates DB | ✓ FLOWING |
| `seedAuthData` | default users | `SELECT COUNT(*) FROM users` then conditional INSERT | Yes — idempotent seed | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Migrate unit suite + getDb boot scan | `npx vitest run lib/migrate lib/db.getDb.boot.unit.test.ts` | 6 files, 35 passed, 1 skipped | ✓ PASS |
| getDb body excludes boot DDL/DML | `lib/db.getDb.boot.unit.test.ts` | 3/3 tests pass | ✓ PASS |
| Checksum drift fails loudly | `lib/migrate/runner.test.ts` | throws `/checksum drift/i` | ✓ PASS |
| Second migrate run idempotent | `lib/migrate/runner.test.ts` (FakeClient) | 1 INSERT total | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no phase-declared probe scripts; migration phase verified via Vitest suite above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| DATA-01 | 19-01, 19-04 | App start connects, guards, seeds only | ✓ SATISFIED | Slim `getDb`, `assertMigrated`, boot unit test |
| DATA-02 | 19-01, 19-02 | Versioned SQL + checksum ledger; 0001 v2.0 baseline | ✓ SATISFIED | Runner/plan/baseline tests; 0001 content |
| DATA-03 | 19-03, 19-04 | Boot UPDATEs moved to `scripts/data-fixes/` | ✓ SATISFIED | Scripts + data-fixes.test; no getDb import |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `lib/db.getDb.boot.unit.test.ts` | DATA-01 | 3 | 0 | No | Value (source scan) | PASS |
| `lib/migrate/assertMigrated.test.ts` | DATA-01 | 4 | 0 | No | Behavioral | PASS |
| `lib/migrate/runner.test.ts` | DATA-02 | 6 | 0 (1 suite skipIf no DB) | No | Behavioral | PASS |
| `lib/migrate/baseline-content.test.ts` | DATA-02 | 8 | 0 | No | Value | PASS |
| `lib/migrate/data-fixes.test.ts` | DATA-03 | 4 | 0 | No | Value | PASS |

**Disabled tests on requirements:** 0 blockers (`describe.skipIf(!hasTestDb)` integration suite is supplementary; unit FakeClient tests cover idempotency)
**Circular patterns detected:** 0
**Insufficient assertions:** 0 blockers

### Prohibitions (negative checks)

| Prohibition | Status | Evidence |
| ----------- | ------ | -------- |
| Must not merge origin v1.0 0001 SQL | ✓ NOT violated | `baseline-content.test.ts` asserts v2.0 tables; no origin-only baseline |
| Must not leave dual writers on boot path | ✓ NOT violated | `getDb` has zero DDL/DML migrate calls; external migrate is sole schema writer at runtime |
| Must not run data-fix UPDATEs on every process start | ✓ NOT violated | Data-fixes only under `scripts/data-fixes/`; not imported by app |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `test/repo-db.ts` | — | Parallel `setupRepoTables()` DDL in test path (WR-04 WONTFIX) | ℹ️ Info | Test-only second schema writer; CI runs migrate first; documented in 19-REVIEW-FIX.md |

No TBD/FIXME/XXX debt markers in phase-delivered migrate artifacts.

### Human Verification

#### 1. Brownfield production stamp (Railway/K8s/local) — ⚡ Auto-approved

**Test:** Against a snapshot of the live shared brownfield database, run `npm run migrate` from an operator machine with production `DATABASE_URL`.
**Expected:** No tables dropped; v2.0 tables intact; `schema_migrations` contains version 1 for `0001-baseline-schema.sql`; second `npm run migrate -- --check` exits 0.
**Why human:** Requires production credentials and real brownfield data; automated suite uses FakeClient and optional scratch Postgres only (19-VALIDATION.md manual-only row).
**Result:** Auto-approved 2026-08-28 under `/gsd-autonomous` (user accepted all recommended defaults). Operator still should run stamp on first production deploy.

### Gaps Summary

No programmatic gaps. Phase goal is achieved in code and tests. One operator deployment verification remains: stamping the live brownfield Railway/K8s database onto the ledger (accepted manual step per VALIDATION.md; user approved auto-approving human verification later).

---

_Verified: 2026-08-28T06:20:00Z_
_Verifier: Claude (gsd-verifier)_
