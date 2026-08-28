---
phase: 19
slug: data-layer-cutover
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-28
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | DATA-02 | T-19-01 | Checksums + ledger prevent silent SQL tampering | unit | `npx vitest run lib/migrate` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | DATA-01 | T-19-02 | Unmigrated DB does not auto-DDL; fails closed | unit | `npx vitest run lib/migrate/assertMigrated.test.ts` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 2 | DATA-02 | T-19-01 | Baseline 0001 has v2.0 tables; no DROP of brownfield | unit | `npx vitest run lib/migrate/baseline-content.test.ts` | ❌ W0 | ⬜ pending |
| 19-03-01 | 03 | 3 | DATA-01, DATA-03 | T-19-02 | `getDb()` connect/assert/seed only; DML not on boot | unit | `npx vitest run lib/db.test.ts lib/migrate` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/migrate/{plan,runner,assertMigrated}.ts` + tests (port from origin branch)
- [ ] `scripts/migrate.ts` + `npm run migrate` + `tsx` devDependency
- [ ] `migrations/0001-baseline-schema.sql` + `migrations/README.md`
- [ ] `lib/migrate/baseline-content.test.ts` asserting v2.0 table names in 0001
- [ ] `scripts/data-fixes/` for former boot-time UPDATEs
- [ ] `.github/workflows/test.yml` — migrate before test once `assertMigrated` is live
- [ ] Slim `lib/db.ts` getDb + keep `resolveSsl`
- [ ] Framework: `tsx` as documented in RESEARCH.md (do not invent a second runner)

Existing DDL unit tests (`lib/db-*.ddl.unit.test.ts`) remain as source-of-truth checks for 0001 Part 3 — do not delete.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stamp a live Railway/K8s/local brownfield DB onto the ledger | DATA-02 | Production credentials and existing data | Operator runbook: `npm run migrate` against a snapshot; confirm no DROP and ledger row present |

All other DATA-01..03 behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
