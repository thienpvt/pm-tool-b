---
phase: 25
slug: kysely-repositories
status: audited
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-28
audited: 2026-08-29
---

# Phase 25 — Validation Strategy

> ENF-02. Nyquist 8e: every requirement maps to a plan and an automated test. Kysely on the existing `pg.Pool`; compile-time columns plus runtime `UnknownColumnError` / `pickAllowed`. Wave 0 vitest `modules/**` glob already shipped in Phase 21. Isolation none; sequential waves. TDD: `test(25-xx)` RED then `feat(25-xx)` GREEN per task.

**Nyquist audit (2026-08-29):** 44/46 automated test files green with `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/pm_tool_test` and `--maxWorkers=1`. Two BLOCKER gaps escalated (25-02-02 ALS rollback, 25-09-01 period rollback). Gate test `kysely-migration.gate.test.ts` green. Run repo suites sequentially — parallel vitest causes pool contention/timeouts.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (jsdom/node already include `modules/**`) |
| **Quick run command** | `npx vitest run --project node lib/db/kysely.test.ts modules/audit/backend/repositories/audit.repo.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~180 seconds |

Do not use `-x` in automated plan commands (Vitest 4 ignores it).

---

## Sampling Rate

- After every task commit: targeted `npx vitest run --project node` on that task's test files (no watch flags)
- After every plan wave: the wave command in that PLAN.md `<verification>`
- Before verify-work: `npm test` and `npm run lint` and `npm run build`
- Max feedback latency: 180 seconds

---

## Requirement → Plan → Test (Nyquist 8e)

| Req | Must-have | Plans | Automated proof | Status |
|-----|-----------|-------|-----------------|--------|
| ENF-02 | Repos query through Kysely on the existing `pg.Pool` | 25-01 through 25-15 | `lib/db/kysely.test.ts` (getPool + PostgresDialect); `kysely-migration.gate.test.ts` (every production `*.repo.ts` uses `getKysely`); per-repo `*.repo.test.ts` | ✅ green (gate + 43/43 repo suites) |
| ENF-02 | Invalid column names fail at TypeScript compile time | 25-01, 25-03–25-14 | `lib/db/database.ts` checked in; `npm run build` typecheck; Kysely `selectFrom`/`updateTable` call sites | ⚠️ `database.ts` present; `npm run build` fails on unrelated missing module (`projects/.../roi/handlers.ts`) |
| ENF-02 | Runtime mass-assignment tests stay | 25-02, 25-13, 25-14 | `_kysely-helpers.test.ts`; `projects.repo.test.ts` and sibling UnknownColumnError cases; `lib/http/with-auth.test.ts` 400 mapping | ✅ green |
| ENF-02 | Single connection pool (no second ORM, no second pool) | 25-01, 25-15 | `kysely.test.ts` factory source contract; `testKysely()` uses `testPool()`; package.json has kysely only (no Prisma/Drizzle) | ✅ green |
| D-04 | pickAllowed, not wholesale Updateable | 25-02, 25-13, 25-14 | `_kysely-helpers.test.ts`; W9b update tests | ✅ green |
| D-06 | Services/routes/wrappers unchanged | 25-04, 25-09, 25-10, 25-14 | Re-run `with-auth.test.ts` / `route.access.test.ts`; weekly `runInTransaction` still in service | ❌ red — `weekly-periods.repo.test.ts` rollback case fails (period not rolled back on shell error) |
| D-09 | kysely@0.29.5 pin | 25-01, 25-15 | package.json + gate test | ✅ green |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | ENF-02, D-09 | T-25-SC | Human confirms kysely@0.29.5 before install | checkpoint | package.json has no kysely until 25-01-02 | ✅ | ⬜ manual |
| 25-01-02 | 01 | 1 | ENF-02, D-01, D-02, D-03, D-09 | T-25-01 | getPool + PostgresDialect; pin 0.29.5 | unit | `npx vitest run --project node lib/db/kysely.test.ts` | ✅ | ✅ green |
| 25-01-03 | 01 | 1 | ENF-02, D-05, D-08 | T-25-02 | Audit insert/list via getKysely on testPool | integration | `npx vitest run --project node modules/audit/backend/repositories/audit.repo.test.ts` | ✅ | ✅ green |
| 25-02-01 | 02 | 2 | ENF-02, D-04 | T-25-03 | pickAllowed throws UnknownColumnError | unit | `npx vitest run --project node lib/repositories/_kysely-helpers.test.ts` | ✅ | ✅ green |
| 25-02-02 | 02 | 2 | ENF-02, D-06 | T-25-04 | Kysely insert rolls back inside runInTransactionOnPool | integration | `npx vitest run --project node lib/db-tx.kysely.test.ts` | ✅ | ❌ red |
| 25-03-01 | 03 | 3 | ENF-02, D-05 | T-25-06 | Dashboard filter upsert via getKysely | integration | `npx vitest run --project node modules/dashboards/backend/repositories/dashboard-filter-state.repo.test.ts` | ✅ | ✅ green |
| 25-03-02 | 03 | 3 | ENF-02, D-05 | T-25-05 | auth.repo via getKysely; lib/auth.ts untouched | integration | `npx vitest run --project node lib/repositories/auth.repo.test.ts` | ✅ | ✅ green |
| 25-03-03 | 03 | 3 | ENF-02, D-05 | T-25-06 | settings.repo via getKysely | integration | `npx vitest run --project node lib/repositories/settings.repo.test.ts` | ✅ | ✅ green |
| 25-04-01 | 04 | 4 | ENF-02, D-05 | T-25-07 | admin + demo-requests via getKysely | integration | `npx vitest run --project node modules/admin/backend/repositories/admin.repo.test.ts modules/admin/backend/repositories/demo-requests.repo.test.ts` | ✅ | ✅ green |
| 25-04-02 | 04 | 4 | ENF-02, D-05 | T-25-07 | users.repo via getKysely | integration | `npx vitest run --project node modules/admin/backend/repositories/users.repo.test.ts` | ✅ | ✅ green |
| 25-04-03 | 04 | 4 | ENF-02, D-05 | T-25-08 | rag-config + jira-config via getKysely | integration | `npx vitest run --project node modules/admin/backend/repositories/rag-config.repo.test.ts modules/admin/backend/repositories/jira-config.repo.test.ts` | ✅ | ✅ green |
| 25-05-01 | 05 | 5 | ENF-02, D-05 | T-25-09 | document-catalog via getKysely | integration | `npx vitest run --project node modules/documents/backend/repositories/document-catalog.repo.test.ts` | ✅ | ✅ green |
| 25-05-02 | 05 | 5 | ENF-02, D-05 | T-25-09 | document-templates via getKysely | integration | `npx vitest run --project node modules/documents/backend/repositories/document-templates.repo.test.ts` | ✅ | ✅ green |
| 25-05-03 | 05 | 5 | ENF-02, D-05 | T-25-09 | checklist via getKysely | integration | `npx vitest run --project node modules/documents/backend/repositories/project-document-checklist.repo.test.ts` | ✅ | ✅ green |
| 25-06-01 | 06 | 6 | ENF-02, D-05 | T-25-11 | import-mapping via getKysely | integration | `npx vitest run --project node modules/jira/backend/repositories/import-mapping.repo.test.ts` | ✅ | ✅ green |
| 25-06-02 | 06 | 6 | ENF-02, D-05 | T-25-10 | operations.repo via getKysely | integration | `npx vitest run --project node modules/operations/backend/repositories/operations.repo.test.ts` | ✅ | ✅ green |
| 25-07-01 | 07 | 7 | ENF-02, D-05 | T-25-12 | programs.repo via getKysely | integration | `npx vitest run --project node modules/portfolio/backend/repositories/programs.repo.test.ts` | ✅ | ✅ green |
| 25-07-02 | 07 | 7 | ENF-02, D-05 | T-25-12 | fiscal-budget via getKysely | integration | `npx vitest run --project node modules/portfolio/backend/repositories/fiscal-budget.repo.test.ts` | ✅ | ✅ green |
| 25-07-03 | 07 | 7 | ENF-02, D-05 | T-25-12 | resources.repo via getKysely | integration | `npx vitest run --project node modules/portfolio/backend/repositories/resources.repo.test.ts` | ✅ | ✅ green |
| 25-08-01 | 08 | 8 | ENF-02, D-05 | T-25-13 | portfolio reads company-scoped | integration | `npx vitest run --project node modules/portfolio/backend/repositories/portfolio.repo.test.ts` | ✅ | ✅ green |
| 25-08-02 | 08 | 8 | ENF-02, D-05 | T-25-13 | portfolio budgets via getKysely | integration | `npx vitest run --project node modules/portfolio/backend/repositories/portfolio.repo.test.ts` | ✅ | ✅ green |
| 25-08-03 | 08 | 8 | ENF-02, D-05 | T-25-13 | portfolio report helpers via getKysely | integration | `npx vitest run --project node modules/portfolio/backend/repositories/portfolio.repo.test.ts` | ✅ | ✅ green |
| 25-09-01 | 09 | 9 | ENF-02, D-05, D-06 | T-25-14 | weekly-periods + rollback | integration | `npx vitest run --project node modules/weekly/backend/repositories/weekly-periods.repo.test.ts` | ✅ | ❌ red |
| 25-09-02 | 09 | 9 | ENF-02, D-05 | T-25-14 | weekly-export via getKysely | integration | `npx vitest run --project node modules/weekly/backend/repositories/weekly-export.repo.test.ts` | ✅ | ✅ green |
| 25-10-01 | 10 | 10 | ENF-02, D-05, D-06 | T-25-15 | weekly-reports reads + insertShell ALS | integration | `npx vitest run --project node modules/weekly/backend/repositories/weekly-reports.repo.test.ts modules/weekly/backend/repositories/weekly-periods.repo.test.ts` | ✅ | ⚠️ partial |
| 25-10-02 | 10 | 10 | ENF-02, D-05 | T-25-15 | weekly-reports writes via getKysely | integration | `npx vitest run --project node modules/weekly/backend/repositories` | ✅ | ✅ green |
| 25-11-01 | 11 | 11 | ENF-02, D-05 | T-25-16 | budget + bugs via getKysely | integration | `npx vitest run --project node modules/projects/backend/repositories/budget.repo.test.ts modules/projects/backend/repositories/bugs.repo.test.ts` | ✅ | ✅ green |
| 25-11-02 | 11 | 11 | ENF-02, D-05 | T-25-16 | documents + holidays via getKysely | integration | `npx vitest run --project node modules/projects/backend/repositories/documents.repo.test.ts modules/projects/backend/repositories/holidays.repo.test.ts` | ✅ | ✅ green |
| 25-11-03 | 11 | 11 | ENF-02, D-05 | T-25-16 | financial-benefits + milestones via getKysely | integration | `npx vitest run --project node modules/projects/backend/repositories/financial-benefits.repo.test.ts modules/projects/backend/repositories/milestones.repo.test.ts` | ✅ | ✅ green |
| 25-12-01 | 12 | 12 | ENF-02, D-05 | T-25-17 | nonfinancial-benefits + dependencies | integration | `npx vitest run --project node modules/projects/backend/repositories/nonfinancial-benefits.repo.test.ts modules/projects/backend/repositories/project-dependencies.repo.test.ts` | ✅ | ✅ green |
| 25-12-02 | 12 | 12 | ENF-02, D-05 | T-25-17 | budget-adjustments + raid history | integration | `npx vitest run --project node modules/projects/backend/repositories/budget-adjustments.repo.test.ts modules/projects/backend/repositories/raid-due-date-history.repo.test.ts` | ✅ | ✅ green |
| 25-12-03 | 12 | 12 | ENF-02, D-05 | T-25-17 | pm-assignments + stakeholders | integration | `npx vitest run --project node modules/projects/backend/repositories/pm-assignments.repo.test.ts modules/projects/backend/repositories/stakeholders.repo.test.ts` | ✅ | ✅ green |
| 25-13-01 | 13 | 13 | ENF-02, D-04 | T-25-18 | updateProject extra keys UnknownColumnError | integration | `npx vitest run --project node modules/projects/backend/repositories/projects.repo.test.ts` | ✅ | ✅ green |
| 25-13-02 | 13 | 13 | ENF-02, D-04 | T-25-19 | updateActivity pickAllowed | integration | `npx vitest run --project node modules/projects/backend/repositories/activities.repo.test.ts` | ✅ | ✅ green |
| 25-13-03 | 13 | 13 | ENF-02, D-04 | T-25-19 | updateRisk pickAllowed | integration | `npx vitest run --project node modules/projects/backend/repositories/risks.repo.test.ts` | ✅ | ✅ green |
| 25-14-01 | 14 | 14 | ENF-02, D-04 | T-25-20 | updateIssue pickAllowed | integration | `npx vitest run --project node modules/projects/backend/repositories/issues.repo.test.ts` | ✅ | ✅ green |
| 25-14-02 | 14 | 14 | ENF-02, D-04 | T-25-20 | updateMeeting pickAllowed | integration | `npx vitest run --project node modules/projects/backend/repositories/meetings.repo.test.ts` | ✅ | ✅ green |
| 25-14-03 | 14 | 14 | ENF-02, D-04, D-06 | T-25-20, T-25-21 | escalations/team + HTTP 400 chain | integration | `npx vitest run --project node modules/projects/backend/repositories/escalations.repo.test.ts modules/projects/backend/repositories/team.repo.test.ts lib/http/with-auth.test.ts app/api/projects/[id]/route.access.test.ts` | ✅ | ✅ green |
| 25-15-01 | 15 | 15 | ENF-02, D-05, D-09 | T-25-22 | All production repos getKysely; pin 0.29.5 | unit | `npx vitest run --project node lib/repositories/kysely-migration.gate.test.ts` | ✅ | ✅ green |
| 25-15-02 | 15 | 15 | ENF-02, D-04, D-05 | T-25-23 | UnknownColumnError remains; SET helper gone | unit | `npx vitest run --project node lib/repositories/_helpers.test.ts lib/repositories/_kysely-helpers.test.ts lib/repositories/kysely-migration.gate.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ partial/flaky*

File Exists: all Wave 0 and per-repo test files on disk (2026-08-29 audit).

Wave 0 infrastructure: `vitest.config.ts` collects `modules/**` and `lib/**`. Run DB-gated suites with `TEST_DATABASE_URL` ending in `_test` and `--maxWorkers=1` to avoid pool contention.

---

## Wave 0 Requirements

- [x] `lib/db/kysely.test.ts` — factory + pin + Database (25-01-02)
- [x] `lib/repositories/_kysely-helpers.test.ts` — pickAllowed (25-02-01)
- [x] `lib/db-tx.kysely.test.ts` — ALS rollback (25-02-02) — **test exists; ❌ red (impl)**
- [x] `lib/repositories/auth.repo.test.ts` — auth conversion (25-03-02)
- [x] `lib/repositories/kysely-migration.gate.test.ts` — W10 glob (25-15-01)
- [x] `vitest.config.ts` node include `{lib,app,eslint,modules}/**/*.test.ts`
- [x] `test/repo-db.ts` + `test/db.ts` — extend with `testKysely()` in 25-01-03 (same pool)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|----------------|-------------------|
| Confirm kysely@0.29.5 on npmjs.com | D-09, T-25-SC | Supply-chain legitimacy (SUS too-new) | 25-01-01 blocking-human checkpoint before npm install |
| App still serves after dual-path | ENF-02 | Cold start / migrate-assert + seed still run via getDb | After W0, sign in and open any project page; no pool exhaustion |

End-of-phase `human_verify_mode` visual pass is orchestrator-owned except 25-01-01 `gate="blocking-human"`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (25-01-01 is manual legitimacy checkpoint)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (files on disk)
- [x] No watch-mode flags
- [x] Feedback latency < 180s (sequential per-file runs ~65s for full Phase 25 map)
- [ ] `nyquist_compliant: true` — blocked by 25-02-02 and 25-09-01 implementation failures

**Approval:** pending — 44/46 test files green; 2 BLOCKER escalations
