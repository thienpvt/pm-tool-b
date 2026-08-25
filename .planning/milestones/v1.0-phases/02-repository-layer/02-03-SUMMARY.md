---
phase: 02-repository-layer
plan: 03
subsystem: database
tags: [repositories, sql-extraction, tenant-isolation, nextjs, postgres]

requires:
  - phase: 02-repository-layer/02-01
    provides: allowlist-gated repository substrate and project resource repositories
  - phase: 02-repository-layer/02-02
    provides: project-scoped repositories reused by routes and export generators
provides:
  - repository-backed portfolio, program, operations, admin, Jira, auth, settings, resource, import, demo-request, and export flows
  - zero direct db.get/db.all/db.run calls in the app tree
  - company-scope and admin-bypass integration suites for four repository families
  - SQL-free Excel, Word, and PowerPoint export services
affects: [03-integration-layer, 05-access-wrapper, 06-enforcement-rollout]

actuals:
  tokens: 53566
  tasks: 4
  commits: 7

tech-stack:
  added: []
  patterns:
    - route handlers resolve authorization context and pass companyId/isAdmin primitives to repositories
    - export generators compose existing repository reads instead of querying the database

key-files:
  created:
    - lib/repositories/auth.repo.ts
    - lib/repositories/resources.repo.ts
    - lib/repositories/demo-requests.repo.ts
    - lib/repositories/import-mapping.repo.ts
    - lib/repositories/portfolio.repo.ts
    - lib/repositories/programs.repo.ts
    - lib/repositories/operations.repo.ts
    - lib/repositories/admin.repo.ts
    - lib/repositories/jira-config.repo.ts
    - lib/repositories/portfolio.repo.test.ts
    - lib/repositories/programs.repo.test.ts
    - lib/repositories/operations.repo.test.ts
    - lib/repositories/admin.repo.test.ts
  modified:
    - app/api/**/route.ts
    - lib/export/excel.ts
    - lib/export/word.ts
    - lib/export/ppt.ts
    - lib/repositories/settings.repo.ts
    - lib/repositories/rag-config.repo.ts
    - lib/repositories/team.repo.ts
    - lib/repositories/documents.repo.ts
    - lib/repositories/escalations.repo.ts
    - test/repo-db.ts

key-decisions:
  - "Keep the legacy customers table name while exposing program-named repository functions."
  - "Keep lib/auth.ts unchanged and move only route-owned authentication SQL."
  - "Leave the missing admin check in app/api/config/route.ts for the Phase 5/6 enforcement rollout."
  - "Pass resolved companyId and isAdmin values into company-scoped repositories; repositories never read sessions."

patterns-established:
  - "Company scope: non-admin queries filter by companyId while an explicit isAdmin boolean selects the bypass branch."
  - "Export composition: generators request named repository shapes and contain no SQL or database imports."

requirements-completed: [REPO-01, REPO-02, REPO-05, REPO-06]

coverage:
  - id: D1
    description: "All remaining route-handler SQL is behind repository functions, leaving no db.get/db.all/db.run calls in app/."
    requirement: REPO-01
    verification:
      - kind: other
        ref: "rg -n 'db\\.(get|all|run)' app (exit=1, no matches)"
        status: pass
      - kind: other
        ref: "npx next build (exit=0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Repository modules remain independent of route/session framework imports and receive authorization primitives from callers."
    requirement: REPO-02
    verification:
      - kind: other
        ref: "rg -n '@/lib/auth|next/server' lib/repositories (exit=1, no matches)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (exit=0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Portfolio, program, operations, and admin suites assert non-admin company isolation and explicit admin bypass."
    requirement: REPO-05
    verification:
      - kind: integration
        ref: "lib/repositories/{portfolio,programs,operations,admin}.repo.test.ts#company scope and admin bypass"
        status: unknown
    human_judgment: true
    rationale: "TEST_DATABASE_URL is unset, so the new real-Postgres integration suites skipped safely but could not execute their assertions in this environment."
  - id: D4
    description: "Excel, Word, and PowerPoint export services compose repository reads and contain no SQL."
    requirement: REPO-01
    verification:
      - kind: other
        ref: "rg -n 'SELECT |INSERT |UPDATE |DELETE ' lib/export (exit=1, no matches)"
        status: pass
      - kind: other
        ref: "npx next build (exit=0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Repository boundaries preserve the protected auth file, legacy customers table, and id-less settings/Jira write behavior."
    requirement: REPO-06
    verification:
      - kind: other
        ref: "git diff --quiet fd396a3^..HEAD -- lib/auth.ts (exit=0)"
        status: pass
      - kind: other
        ref: "rg -n 'lastInsertRowid' lib/repositories/settings.repo.ts lib/repositories/jira-config.repo.ts (exit=1, no matches)"
        status: pass
      - kind: other
        ref: "rg -n 'TABLE programs' lib/db.ts (exit=1, no matches)"
        status: pass
    human_judgment: false

duration: "1h 20m active across recovery sessions"
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 03: Remaining Route SQL to Repositories Summary

**All remaining route and export-service SQL now sits behind repository boundaries, with explicit company scope and admin-bypass tests for the company-level repositories.**

## Performance

- **Duration:** 1h 20m active across two recovery sessions (38h elapsed including pause)
- **Started:** 2026-08-08T00:00:37+07:00
- **Completed:** 2026-08-09T14:17:44+07:00
- **Tasks:** 4
- **Files modified:** 82 commit-level paths (75 source/test paths plus 7 temporary planning-file deletions)

## Accomplishments

- Removed every direct `db.get`, `db.all`, and `db.run` call from `app/` route handlers.
- Added or extended repositories for portfolio, programs, operations, admin, Jira configuration, auth, settings, resources, demo requests, and import mappings.
- Removed SQL from all three export generators found by the required scan: `excel.ts`, `word.ts`, and `ppt.ts`.
- Added company isolation/admin bypass suites for portfolio, programs, operations, and admin repositories using the guarded Postgres test harness.
- Preserved `lib/auth.ts`, the `customers` table name, and id-less settings/Jira write semantics.

## Task Commits

Each task was committed atomically; recovery preserved all prior commits:

1. **Task 1: Portfolio and programs** - `c33365a` (feat)
2. **Task 2: Auth and settings route SQL** - `fd396a3` (feat)
3. **Task 2: Operations, admin, and Jira route SQL** - `441bcca` (feat)
4. **Task 3: Remaining resource/import/demo/export route SQL** - `bac1d9d` (feat)
5. **Task 3: Export service SQL behind repositories** - `04d8594` (feat)
6. **Task 4: Company-scoped repository isolation tests** - `151532d` (test)
7. **Recovery cleanup: Remove accidentally committed temporary files** - `444b0cb` (chore)

## Files Created/Modified

- `lib/repositories/portfolio.repo.ts` - Portfolio lists, reports, roadmap, budgets, members, quota, allocation, milestone, and bug-assignee queries.
- `lib/repositories/programs.repo.ts` - Program operations backed by the legacy `customers` table and project allocations.
- `lib/repositories/operations.repo.ts` - Operations systems, budget items, expenses, and incident persistence.
- `lib/repositories/admin.repo.ts` - Company/user administration, demo-request administration, and resource-audit reads.
- `lib/repositories/jira-config.repo.ts` - Company Jira configuration and JQL preset persistence without `lastInsertRowid` assumptions.
- `lib/repositories/auth.repo.ts` - Route-owned user/password/onboarding queries while leaving `lib/auth.ts` untouched.
- `lib/export/excel.ts`, `lib/export/word.ts`, `lib/export/ppt.ts` - Repository-composed project exports with no embedded SQL.
- `lib/repositories/portfolio.repo.test.ts`, `lib/repositories/programs.repo.test.ts`, `lib/repositories/operations.repo.test.ts`, `lib/repositories/admin.repo.test.ts` - Company isolation and admin bypass integration suites.
- `test/repo-db.ts` - Added the company, program, operations, and admin table shapes required by the new guarded integration suites.

## Decisions Made

- Repository functions accept resolved `companyId` and `isAdmin` primitives. Session resolution remains in route handlers.
- Program terminology remains a domain-layer name only; SQL continues using `customers` and `customer_id`.
- Export-specific ordering is explicit where needed. `listEscalationsForExport` preserves the workbook's ascending level order rather than reusing the route's descending list.
- The configuration route remains authorization-neutral in this refactor. Its missing admin check is recorded below for Phase 5/6.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Moved SQL from the PowerPoint export service**

- **Found during:** Task 3 (required `lib/export/` SQL scan)
- **Issue:** The plan's `read_first` list named `excel.ts` and `word.ts`, but `ppt.ts` also contained direct project graph SQL and therefore violated REPO-01.
- **Fix:** Rewired `ppt.ts` to project, team, meeting, risk, activity, and document repositories.
- **Files modified:** `lib/export/ppt.ts`, `lib/repositories/documents.repo.ts`
- **Verification:** The `lib/export/` SQL scan returns no matches; TypeScript and Next build pass.
- **Committed in:** `04d8594`

**2. [Rule 1 - Bug] Preserved export ordering while reusing route repositories**

- **Found during:** Task 3 semantic comparison
- **Issue:** The existing escalation repository sorts levels descending for its route, while the Excel export previously sorted ascending. Reusing it directly reversed workbook output. The existing document list also introduced a sort the PPT query did not have.
- **Fix:** Added an ascending export read for escalation levels and fetched the charter document directly instead of reusing the sorted document list.
- **Files modified:** `lib/repositories/escalations.repo.ts`, `lib/export/excel.ts`, `lib/export/ppt.ts`, `lib/repositories/documents.repo.ts`
- **Verification:** SQL shapes match the prior export behavior; TypeScript and Next build pass.
- **Committed in:** `04d8594`

**3. [Rule 3 - Blocking] Expanded the test DDL for company-scoped repositories**

- **Found during:** Task 4
- **Issue:** The Phase 1/Plan 01 harness did not define the company, user, program metadata, or operations tables needed by the four new suites.
- **Fix:** Extended `test/repo-db.ts` with minimal production-compatible DDL and a `seedCompany` helper.
- **Files modified:** `test/repo-db.ts`
- **Verification:** `npx tsc --noEmit` passes and `npm test` skips the database suites safely when the database URL is absent.
- **Committed in:** `151532d`

**4. [Rule 3 - Blocking] Mapped the obsolete allowlist read target**

- **Found during:** Task 1 plan read gate
- **Issue:** `lib/repositories/allowlist.ts` does not exist in the current repository layout.
- **Fix:** Used the current shared allowlist implementation at `lib/repositories/_helpers.ts` as the authoritative replacement.
- **Files modified:** None for this mapping.
- **Verification:** Repository modules compile and the repository boundary scan passes.
- **Committed in:** N/A

---

**Total deviations:** 4 handled (1 missing critical extraction, 1 behavior-preservation bug, 2 execution blockers).

**Impact on plan:** All changes were required to satisfy the stated repository boundary and behavior-preservation criteria; no authorization rollout was added.

## Behavior Note

Operations routes now pass the resolved `isAdmin` value into repository access functions, so admins bypass the operations company predicate. The prior operations routes always applied `company_id`; the explicit bypass is the plan's required company-repository contract and is covered by the new operations suite. This is an intentional plan-driven scoping interpretation, not an unrecorded authorization change.

## Verification Outcomes

The final close-out commands produced:

```text
rg -n 'db\.(get|all|run)' app
exit=1

rg -n '@/lib/auth|next/server' lib/repositories
exit=1

rg -n 'SELECT |INSERT |UPDATE |DELETE ' lib/export
exit=1

rg -n 'lastInsertRowid' lib/repositories/settings.repo.ts lib/repositories/jira-config.repo.ts
exit=1

git diff --quiet -- lib/auth.ts
working_auth_exit=0
git diff --quiet fd396a3^..HEAD -- lib/auth.ts
plan_auth_exit=0

rg -n 'TABLE programs' lib/db.ts
exit=1

rg -n '@/lib/auth|requireAdmin|isAdmin|admin' app/api/config/route.ts
exit=1

npx tsc --noEmit
exit=0

npx next build
exit=0

npm test
Test Files  4 passed | 20 skipped (24)
Tests       23 passed | 109 skipped (132)
exit=0

TEST_DATABASE_URL_set=False
```

Exit `1` for each `rg` command is the expected no-match result.

## Issues Encountered

- `TEST_DATABASE_URL` is unset. The full suite exits 0 and the guarded repository suites skip, but the four new company-scope suites could not execute against a real `*_test` Postgres database in this environment.
- Vitest emits a non-blocking warning that `vitest.config.ts` uses ESM syntax while loaded as CommonJS under the future native config loader.

## Open Findings for Later Phases

- `app/api/config/route.ts` still accepts settings writes, including the Anthropic API key, without an admin check. This was deliberately not changed and remains a Phase 5/6 enforcement item.
- Run the four new repository suites with a configured `TEST_DATABASE_URL` ending in `_test` before treating their behavioral coverage as fully automated.

## User Setup Required

None - no external service configuration was added. A guarded Postgres test URL is optional for executing the skipped integration suites.

## Next Phase Readiness

- Plan 02-03 is complete and ready for phase-level verification.
- `.planning/STATE.md` and `.planning/ROADMAP.md` were intentionally not modified during this recovery close-out.

## Self-Check: PASSED

- All seven listed commits exist in history.
- All key files exist and the summary coverage block is populated.
- All task and plan verification commands pass with the expected no-match exit codes.
- Protected user/orchestrator files remain unstaged and untouched by plan commits.

---
*Phase: 02-repository-layer*
*Completed: 2026-08-09*
