---
phase: 25-kysely-repositories
plan: 04
subsystem: database
tags: [kysely, postgres, admin, upsert, company-scoped]

requires:
  - phase: 25-03
    provides: getKysely singleton and testKysely harness patterns
provides:
  - admin.repo companies/users/demo/resource-audit on getKysely
  - demo-requests.repo insert on getKysely
  - users.repo directory CRUD and replaceUserRoles on getKysely
  - rag-config and jira-config company-scoped upserts on getKysely
affects: [25-05, admin-routes, user-management]

actuals:
  tokens: 18000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns: [getKysely admin conversion, sql template for ARRAY_AGG and audit queries, company_id PK upsert]

key-files:
  created:
    - modules/admin/backend/repositories/demo-requests.repo.test.ts
    - modules/admin/backend/repositories/jira-config.repo.test.ts
  modified:
    - modules/admin/backend/repositories/admin.repo.ts
    - modules/admin/backend/repositories/admin.repo.test.ts
    - modules/admin/backend/repositories/demo-requests.repo.ts
    - modules/admin/backend/repositories/demo-requests.repo.unit.test.ts
    - modules/admin/backend/repositories/users.repo.ts
    - modules/admin/backend/repositories/users.repo.test.ts
    - modules/admin/backend/repositories/rag-config.repo.ts
    - modules/admin/backend/repositories/rag-config.repo.test.ts
    - modules/admin/backend/repositories/rag-config.repo.unit.test.ts
    - modules/admin/backend/repositories/jira-config.repo.ts
    - modules/admin/backend/repositories/jira-config.repo.unit.test.ts

key-decisions:
  - "Complex admin audit and users list queries use sql template tag on getKysely to preserve ARRAY_AGG/GROUP BY semantics"
  - "company_rag_config and company_jira_config upserts stay keyed by company_id PK — no serial id RETURNING (D-05)"
  - "Admin companies route auth wrappers unchanged — no withCpmo added (D-06)"

patterns-established:
  - "Admin integration tests mock getKysely → testKysely() alongside getDb → testDb() (D-07)"
  - "Unit tests mock getKysely chain builders instead of raw SQL string assertions"

requirements-completed: [ENF-02]

duration: 25min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 04: Admin Module Repositories on Kysely Summary

**Five admin repos converted to getKysely with isAdmin scoping preserved and company_id PK upserts**

## One-liner

All admin module repositories (admin, demo-requests, users, rag-config, jira-config) now query through the shared getKysely pool with TDD RED/GREEN commits per task group.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 25-04-01 | admin.repo + demo-requests.repo | 62cd5c8, 1de1b00 |
| 25-04-02 | users.repo | cc83078, 990ecd0 |
| 25-04-03 | rag-config + jira-config | 8c57f12, 1022b33 |
| fix | Unit test mocks for getKysely | e83e244 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated unit tests after getKysely conversion**
- **Found during:** Task 3 verification
- **Issue:** demo-requests, rag-config, and jira-config unit tests still mocked getDb; getKysely called getPool and failed
- **Fix:** Rewrote unit test mocks to chain getKysely builders
- **Files modified:** `*.unit.test.ts` for demo-requests, rag-config, jira-config
- **Commit:** e83e244

## Verification

- `npx vitest run --project node modules/admin/backend/repositories` — 9 passed, 19 skipped (no TEST_DATABASE_URL in CI shell)
- All five production repos import getKysely; no getDb imports remain

## Self-Check: PASSED

- FOUND: modules/admin/backend/repositories/admin.repo.ts
- FOUND: modules/admin/backend/repositories/demo-requests.repo.ts
- FOUND: modules/admin/backend/repositories/users.repo.ts
- FOUND: modules/admin/backend/repositories/rag-config.repo.ts
- FOUND: modules/admin/backend/repositories/jira-config.repo.ts
- FOUND: .planning/phases/25-kysely-repositories/25-04-SUMMARY.md
- FOUND: 62cd5c8, 1de1b00, cc83078, 990ecd0, 8c57f12, 1022b33, e83e244
