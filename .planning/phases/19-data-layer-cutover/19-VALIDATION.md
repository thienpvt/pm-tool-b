---
phase: 19
slug: data-layer-cutover
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-28
validated: 2026-08-29
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for DATA-01, DATA-02, DATA-03. Server/CLI tests are the gate (infrastructure phase; UI-SPEC skipped — false-positive “dashboard” token on schema tables).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run lib/migrate` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~120 seconds |

Do not use `-x` in automated plan commands (Vitest 4 ignores it).

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run lib/migrate` (or the task's `<automated>` files)
- **After every plan wave:** Run `npm test` (with migrate pre-step once `assertMigrated` is live)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Requirement Must-Haves

| Req | Must-have behavior | Automated proof | Min test type |
|-----|-------------------|-----------------|---------------|
| **DATA-01** | `getDb()` does not call `initPostgresSchema`, `migratePostgresSchema`, or `lib/db-*.ts` migrate helpers | `lib/db.ts` source scan + `lib/migrate/assertMigrated` tests | unit |
| **DATA-01** | Unmigrated DB fails fast with a runbook message (do not create schema) | `assertMigrated.test.ts` | unit |
| **DATA-01** | After migrate, `getDb()` connects, asserts ledger, seeds only | `getDb` unit + seed still runs | unit |
| **DATA-02** | Ledger records version + checksum per SQL file | `lib/migrate/runner.test.ts` | unit |
| **DATA-02** | Checksum drift fails loudly | `lib/migrate/plan.test.ts` | unit |
| **DATA-02** | Second migrate run is idempotent | `lib/migrate/runner.test.ts` | integration |
| **DATA-02** | `migrations/0001` includes v2.0 tables: weekly, fiscal, roles, RAID master, dashboard, checklist, audit | `lib/migrate/baseline-content.test.ts` | unit |
| **DATA-02** | `npm run migrate` applies versioned SQL | package.json script + runner | unit/smoke |
| **DATA-03** | Boot-time DML (`UPDATE`s) live under `scripts/data-fixes/` and are not re-run on every `getDb()` | data-fixes tests + `getDb` source scan | unit |
| **DATA-01..03** | Brownfield stamp: existing DB recorded on ledger without DROP of v2.0 tables | runner stamp test | unit |
| **DATA-01..03** | CI applies migrate before tests once assert is live | `.github/workflows/test.yml` | smoke |

---

## Per-Task Verification Map

12 PLAN tasks. 19-03 is Wave 2 DATA-03 (parallel with 19-02; uses pre-existing helpers). 19-04-01 is Wave 3 DATA-01 slim `getDb`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | DATA-02 | T-19-01 | Checksums + ledger prevent silent SQL tampering | unit | `npx vitest run lib/migrate/plan.test.ts lib/migrate/runner.test.ts lib/migrate/assertMigrated.test.ts` | ✅ | ✅ green |
| 19-01-02 | 01 | 1 | DATA-02 | T-19-01 | Drift, duplicate versions, ROLLBACK fail loud | unit | `npx vitest run lib/migrate/plan.test.ts lib/migrate/runner.test.ts` | ✅ | ✅ green |
| 19-01-03 | 01 | 1 | DATA-02 | T-19-SC | tsx pin; CLI wires parseMigrationFile and runMigrations | smoke | `node -e` package.json `scripts.migrate` + `tsx` 4.23.12; `scripts/migrate.ts` contains parseMigrationFile and runMigrations | ✅ | ✅ green |
| 19-02-01 | 02 | 2 | DATA-02 | T-19-01 | ROLES_AUDIT_DDL and MAPPING_TENANT_DDL exported | unit | `npx vitest run lib/db-roles.ddl.unit.test.ts lib/db-weekly-reports.ddl.unit.test.ts` | ✅ | ✅ green |
| 19-02-02 | 02 | 2 | DATA-02 | T-19-06, T-19-07 | 0001 v2.0 tables; no DROP; RAID DML before indexes | unit | `npx vitest run lib/migrate/baseline-content.test.ts lib/migrate/plan.test.ts` | ✅ | ✅ green |
| 19-02-03 | 02 | 2 | DATA-02 | T-19-03 | README ledger + single-writer | smoke | `node -e` `migrations/README.md` contains npm run migrate, schema_migrations, parallel | ✅ | ✅ green |
| 19-03-01 | 03 | 2 | DATA-03 | T-19-08 | Four boot UPDATEs as operator scripts | unit | `npx vitest run lib/migrate/data-fixes.test.ts` | ✅ | ✅ green |
| 19-03-02 | 03 | 2 | DATA-03 | T-19-08 | v2.0 backfill operator scripts | unit | `npx vitest run lib/migrate/data-fixes.test.ts` | ✅ | ✅ green |
| 19-03-03 | 03 | 2 | DATA-03 | T-19-08 | data-fixes README command list | smoke | `node -e` `scripts/data-fixes/README.md` lists 01-users-onboarding-completed and backfill-mapping-tenant | ✅ | ✅ green |
| 19-04-01 | 04 | 3 | DATA-01, DATA-03 | T-19-02, T-19-09 | getDb connect/assert/seed only; no boot DDL/DML | unit | `npx vitest run lib/db.getDb.boot.unit.test.ts lib/db-documents.ddl.unit.test.ts lib/db-dashboards.ddl.unit.test.ts lib/db-fiscal-budget.ddl.unit.test.ts lib/db-weekly-reports.ddl.unit.test.ts lib/migrate/assertMigrated.test.ts` | ✅ | ✅ green |
| 19-04-02 | 04 | 3 | DATA-01 | T-19-10 | Docker/Railway/compose/K8s migrate-then-server with tsx | smoke | `node -e` Dockerfile/.dockerignore/railway.json/k8s-migrate-job.yaml; `docker-compose.yml` command includes tsx and scripts/migrate.ts | ✅ | ✅ green |
| 19-04-03 | 04 | 3 | DATA-01 | T-19-02 | CI migrate before tests | smoke | `node -e` `.github/workflows/test.yml` contains npm run migrate and pm_tool_test | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `lib/migrate/{plan,runner,assertMigrated}.ts` + tests (port from origin branch)
- [x] `scripts/migrate.ts` + `npm run migrate` + `tsx` devDependency
- [x] `migrations/0001-baseline-schema.sql` + `migrations/README.md`
- [x] `lib/migrate/baseline-content.test.ts` asserting v2.0 table names in 0001
- [x] `scripts/data-fixes/` for former boot-time UPDATEs
- [x] `.github/workflows/test.yml` — migrate before test once `assertMigrated` is live
- [x] Slim `lib/db.ts` getDb + keep `resolveSsl`
- [x] Framework: `tsx` as documented in RESEARCH.md (do not invent a second runner)

Existing DDL unit tests (`lib/db-*.ddl.unit.test.ts`) remain as source-of-truth checks for 0001 Part 3 — do not delete.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stamp a live Railway/K8s/local brownfield DB onto the ledger | DATA-02 | Production credentials and existing data | Operator runbook: `npm run migrate` against a snapshot; confirm no DROP and ledger row present |

All other DATA-01..03 behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-29 — `19-VERIFICATION.md` passed 7/7 must-haves; migrate + getDb tests green (NYQ-01, D-05)
