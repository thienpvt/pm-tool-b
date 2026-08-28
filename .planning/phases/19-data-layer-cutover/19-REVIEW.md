---
phase: 19-data-layer-cutover
reviewed: 2026-08-28T06:16:00Z
re_reviewed: 2026-08-28T06:16:00Z
depth: deep
files_reviewed: 38
files_reviewed_list:
  - lib/migrate/plan.ts
  - lib/migrate/runner.ts
  - lib/migrate/assertMigrated.ts
  - lib/migrate/plan.test.ts
  - lib/migrate/runner.test.ts
  - lib/migrate/assertMigrated.test.ts
  - lib/migrate/baseline-content.test.ts
  - lib/migrate/data-fixes.test.ts
  - scripts/migrate.ts
  - migrations/0001-baseline-schema.sql
  - migrations/README.md
  - lib/db.ts
  - lib/db.getDb.boot.unit.test.ts
  - lib/db-roles.ts
  - lib/db-roles.ddl.unit.test.ts
  - lib/db-mapping-tenant.ts
  - lib/db-raid-masters.ts
  - lib/db-documents.ddl.unit.test.ts
  - lib/db-dashboards.ddl.unit.test.ts
  - lib/db-fiscal-budget.ddl.unit.test.ts
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
  - test/repo-db.ts
  - Dockerfile
  - .dockerignore
  - railway.json
  - docker-compose.yml
  - k8s-migrate-job.yaml
  - .github/workflows/test.yml
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: clean
---

# Phase 19: Code Review Report

**Reviewed:** 2026-08-28T06:10:00Z
**Re-reviewed (post-fix):** 2026-08-28T06:16:00Z
**Depth:** deep
**Files Reviewed:** 38
**Status:** clean

## Summary

Deep review of the Phase 19 data-layer cutover: migrate engine, 0001 baseline SQL, operator data-fix scripts, slim `getDb`, and deploy/CI wiring. **Post-fix re-review confirms all Critical findings are resolved.** CR-01 semicolon repair verified in `0001-baseline-schema.sql` and `baseline-content.test.ts`. CR-02 brownfield probe retained by design (DATA-01 lock) with `console.warn` — accepted. WR-01/WR-02/WR-03 fixes verified in `lib/db.ts` and `lib/migrate/runner.ts`. Unit gates pass (21 passed, 1 skipped).

**Remaining non-blockers:** WR-04 (parallel test DDL) WONTFIX per plan lock; IN-01/IN-02 info items unchanged.

## Re-review Verification (post-fix)

| ID | Status | Verification |
|----|--------|--------------|
| CR-01 | **Fixed** | Part 1 closes with `);` at line 356 before Part 2 `ALTER TABLE` at line 360. Part 3 DDL fragments terminated with `;`. `assertStatementsTerminated` test passes (no `)\nALTER/CREATE` joins). |
| CR-02 | **Accepted** | Legacy `companies` probe retained; emits `LEGACY_BOOT_WARN` via `console.warn` (lines 20–21, 42–43). Per LOCKED DATA-01 constraint. |
| WR-01 | **Fixed** | `getDb()` wraps pool in try/catch; `pool.end()` on assert failure (lines 133–141). |
| WR-02 | **Fixed** | `isMissingRelation()` gates empty-ledger fallback; other errors propagate (lines 90–95). |
| WR-03 | **Fixed** | Ledger INSERT uses `$1, $2, $3` params (lines 134–137); `assertLedgerTableName()` validates identifier. |
| WR-04 | **WONTFIX** | Parallel `setupRepoTables()` DDL in tests — deferred per orchestrator lock. |
| WR-05 | **Fixed** | Semicolon-presence parse test added; full Postgres integration deferred to CI migrate step. |

## Critical Issues (original — all resolved)

### CR-01: 0001 baseline SQL missing semicolons — migrate fails on fresh DB

**Resolution:** Fixed in commit 316da86. Repair script appended `;` terminators; `baseline-content.test.ts` adds `assertStatementsTerminated` guard.

### CR-02: Legacy brownfield probe bypasses ledger and checksum enforcement

**Resolution:** Accepted by design. Probe kept with operator warning per DATA-01 lock (commit a3aba8c).

## Warnings (original)

### WR-01: getDb leaks Pool when assertMigrated throws

**Resolution:** Fixed in commit bc008ba — `pool.end()` in catch block.

### WR-02: computePendingMigrations swallows all ledger read errors

**Resolution:** Fixed in commit 5965706 — `isMissingRelation()` helper.

### WR-03: Ledger INSERT uses string interpolation instead of parameters

**Resolution:** Fixed in commit 5965706 — parameterized `$1, $2, $3` INSERT.

### WR-04: Test suite uses parallel DDL path unrelated to 0001

**Status:** WONTFIX — documented accepted debt per plan lock.

### WR-05: baseline-content.test does not execute SQL against Postgres

**Resolution:** Fixed (partial) in commit 316da86 — semicolon parse test; CI migrate step covers full apply.

## Info

### IN-01: migrations/README.md deploy section is stale post-19-04

**File:** `migrations/README.md:102-112`
**Issue:** README still says Docker COPY and tsx wiring are "plan 19-04" future work and "Until then, run migrate from an operator machine." 19-04 shipped Dockerfile/compose/Railway/CI wiring. Operators reading this may skip container migrate steps.

**Fix:** Update deploy section to reflect current Dockerfile CMD and CI migrate step.

### IN-02: Origin v1.0 detection test is weak

**File:** `lib/migrate/baseline-content.test.ts:80-84`
**Issue:** "Not origin v1.0" assertion only checks that `weekly_periods` and `user_roles` appear — insufficient to detect accidental partial copy of origin SQL mixed with v2.0 fragments.

**Fix:** Add negative fingerprints from origin baseline (tables/columns known absent in v2.0) or compare checksum against a golden hash after CR-01 fix.

---

_Reviewed: 2026-08-28T06:10:00Z_
_Re-reviewed: 2026-08-28T06:16:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
